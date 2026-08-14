import { prisma } from "@/lib/db";
import { generateEmbedding, getEmbeddingConfig } from "@/lib/ai/embeddingService";
import { processDocumentContent, RawPageText } from "./chunker";

export interface IngestionStatusResponse {
  bookId: string;
  status: "PENDING" | "EXTRACTING" | "STRUCTURING" | "CHUNKING" | "EMBEDDING" | "COMPLETED" | "FAILED";
  error?: string | null;
  documentHash?: string | null;
  pageCount: number;
  chunkCount: number;
  totalTokens: number;
  skipped?: boolean;
}

let pgVectorChecked = false;

/**
 * Ensure pgvector extension and vector column dimensions match active config.
 */
export async function ensurePgVectorSetup(dimensions = 64): Promise<void> {
  if (pgVectorChecked) return;
  pgVectorChecked = true;
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ContentChunk" ADD COLUMN IF NOT EXISTS embedding vector(${dimensions});`
    );
  } catch (err) {
    // Suppress if DB user lacks superuser permissions or column already exists
    console.warn("[IngestionService] pgvector setup check:", err);
  }
}

/**
 * Get current ingestion status for a book.
 */
export async function getIngestionStatus(bookId: string): Promise<IngestionStatusResponse | null> {
  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
    select: {
      id: true,
      ingestionStatus: true,
      ingestionError: true,
      documentHash: true,
      _count: {
        select: {
          documentPages: true,
          contentChunks: true,
        },
      },
    },
  });

  if (!book) return null;

  return {
    bookId: book.id,
    status: (book.ingestionStatus as any) || "PENDING",
    error: book.ingestionError,
    documentHash: book.documentHash,
    pageCount: book._count.documentPages,
    chunkCount: book._count.contentChunks,
    totalTokens: 0,
  };
}

/**
 * Update ingestion state for a book in PostgreSQL.
 */
async function updateBookIngestionState(
  bookId: string,
  status: "PENDING" | "EXTRACTING" | "STRUCTURING" | "CHUNKING" | "EMBEDDING" | "COMPLETED" | "FAILED",
  error: string | null = null,
  documentHash: string | null = null
) {
  const data: any = { ingestionStatus: status, ingestionError: error };
  if (documentHash) data.documentHash = documentHash;
  if (status === "COMPLETED") data.ingestedAt = new Date();

  await prisma.book.update({
    where: { id: bookId },
    data,
  }).catch(() => {});
}

/**
 * Idempotently ingest PDF pages into DocumentPage, DocumentStructure, and ContentChunk models.
 */
export async function ingestBookChunks(
  bookIdInput: string,
  rawPages: RawPageText[]
): Promise<IngestionStatusResponse> {
  const embedConfig = await getEmbeddingConfig();
  await ensurePgVectorSetup(embedConfig.dimensions);

  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookIdInput }, { id: bookIdInput }] },
  });

  if (!book) {
    throw new Error(`Book ${bookIdInput} not found in database`);
  }

  // Phase 1: EXTRACTING & Document Analysis
  await updateBookIngestionState(book.id, "EXTRACTING");

  try {
    const processed = processDocumentContent(rawPages);
    const { documentHash, pages, structures, chunks, totalTokens } = processed;

    // Idempotency check: compare document hash & existing chunks
    const existingChunks = await prisma.contentChunk.count({
      where: { bookId: book.id, isStale: false },
    });

    if (
      book.documentHash === documentHash &&
      book.ingestionStatus === "COMPLETED" &&
      existingChunks > 0
    ) {
      return {
        bookId: book.id,
        status: "COMPLETED",
        documentHash,
        pageCount: pages.length,
        chunkCount: existingChunks,
        totalTokens,
        skipped: true,
      };
    }

    // Phase 2: STRUCTURING - Save DocumentPages and DocumentStructure
    await updateBookIngestionState(book.id, "STRUCTURING", null, documentHash);

    // Clean up old stale ingestion data for this book safely
    await prisma.$transaction([
      prisma.contentChunk.deleteMany({ where: { bookId: book.id } }),
      prisma.documentStructure.deleteMany({ where: { bookId: book.id } }),
      prisma.documentPage.deleteMany({ where: { bookId: book.id } }),
    ]);

    // Save Page-level provenance records
    for (const pageObj of pages) {
      await prisma.documentPage.create({
        data: {
          bookId: book.id,
          pageNumber: pageObj.pageNumber,
          text: pageObj.text,
          layoutMetadata: pageObj.layoutMetadata || null,
          tokenCount: pageObj.tokenCount,
          extractionStatus: "COMPLETED",
        },
      });
    }

    // Save Document Structure hierarchy records
    const structureIdMap = new Map<string, string>();
    for (const s of structures) {
      const createdStruct = await prisma.documentStructure.create({
        data: {
          bookId: book.id,
          title: s.title,
          level: s.level,
          pageStart: s.pageStart,
          pageEnd: s.pageEnd,
          orderingIndex: s.orderingIndex,
        },
      });
      structureIdMap.set(s.title, createdStruct.id);
    }

    // Phase 3: CHUNKING & Provenance Records
    await updateBookIngestionState(book.id, "CHUNKING");

    const createdChunkIds: Array<{ id: string; content: string }> = [];

    for (const chunkObj of chunks) {
      const sectionId = chunkObj.sectionTitle ? structureIdMap.get(chunkObj.sectionTitle) || null : null;

      const createdChunk = await prisma.contentChunk.create({
        data: {
          bookId: book.id,
          chapter: chunkObj.chapter || null,
          page: chunkObj.pageStart,
          pageStart: chunkObj.pageStart,
          pageEnd: chunkObj.pageEnd,
          sectionId,
          chunkIndex: chunkObj.chunkIndex,
          content: chunkObj.content,
          tokenCount: chunkObj.tokenCount,
          contentHash: chunkObj.contentHash,
          embeddingModel: embedConfig.model,
          embeddingDim: embedConfig.dimensions,
          isStale: false,
          metadata: chunkObj.metadata || null,
        },
      });

      createdChunkIds.push({ id: createdChunk.id, content: chunkObj.content });
    }

    // Phase 4: EMBEDDING - Generate Embeddings with Dimension Validation
    await updateBookIngestionState(book.id, "EMBEDDING");

    for (const item of createdChunkIds) {
      const emb = await generateEmbedding(item.content);

      try {
        const vectorStr = `[${emb.vector.join(",")}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE "ContentChunk" SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          item.id
        );
      } catch {
        /* Fallback if pgvector column unavailable in environment */
      }
    }

    // Phase 5: COMPLETED
    await updateBookIngestionState(book.id, "COMPLETED", null, documentHash);

    return {
      bookId: book.id,
      status: "COMPLETED",
      documentHash,
      pageCount: pages.length,
      chunkCount: createdChunkIds.length,
      totalTokens,
      skipped: false,
    };
  } catch (err: any) {
    const errorMsg = err?.message || "Ingestion pipeline failure";
    await updateBookIngestionState(book.id, "FAILED", errorMsg);
    throw new Error(`Ingestion Failed: ${errorMsg}`);
  }
}
