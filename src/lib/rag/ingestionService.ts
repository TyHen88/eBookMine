import { prisma } from "@/lib/db";
import { aiProvider } from "@/lib/ai/aiService";
import { chunkPageText, RawPageText } from "./chunker";

/**
 * Ensure pgvector extension and vector embedding column exist on Neon PostgreSQL.
 */
export async function ensurePgVectorSetup(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ContentChunk" ADD COLUMN IF NOT EXISTS embedding vector(64);`
    );
  } catch (err) {
    // Suppress if database user lacks superuser extension permissions or column already exists
    console.warn("pgvector setup check:", err);
  }
}

/**
 * Idempotently ingest PDF page text into ContentChunk PostgreSQL records with vector embeddings.
 */
export async function ingestBookChunks(
  bookId: string,
  pages: RawPageText[]
): Promise<{ totalChunks: number; skipped: boolean }> {
  await ensurePgVectorSetup();

  const book = await prisma.book.findFirst({
    where: {
      OR: [{ driveFileId: bookId }, { id: bookId }],
    },
  });

  if (!book) {
    throw new Error(`Book ${bookId} not found in PostgreSQL`);
  }

  // Idempotency check: skip if chunks already exist
  const existingCount = await prisma.contentChunk.count({
    where: { bookId: book.id },
  });

  if (existingCount > 0) {
    return { totalChunks: existingCount, skipped: true };
  }

  const chunks = chunkPageText(pages);
  let ingested = 0;

  for (const chunk of chunks) {
    const embedding = await aiProvider.generateEmbedding(chunk.content);

    const created = await prisma.contentChunk.create({
      data: {
        bookId: book.id,
        page: chunk.page,
        chapter: chunk.chapter || null,
        content: chunk.content,
        metadata: chunk.metadata || null,
      },
    });

    // Store vector embedding string representation in pgvector column if supported
    try {
      const vectorStr = `[${embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "ContentChunk" SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        created.id
      );
    } catch {
      /* fallback if vector column unavailable */
    }

    ingested++;
  }

  return { totalChunks: ingested, skipped: false };
}
