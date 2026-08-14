import { prisma } from "@/lib/db";
import { generateEmbedding } from "@/lib/ai/embeddingService";

export interface RetrievedChunk {
  id: string;
  page: number;
  pageStart: number;
  pageEnd: number;
  chapter?: string | null;
  sectionId?: string | null;
  tokenCount: number;
  contentHash?: string | null;
  content: string;
  similarity: number;
}

/**
 * Retrieve top K relevant content chunks for a book query using vector similarity or keyword search.
 * Filters out stale chunks.
 */
export async function retrieveRelevantChunks(
  bookId: string,
  query: string,
  limit = 4
): Promise<RetrievedChunk[]> {
  const book = await prisma.book.findFirst({
    where: {
      OR: [{ driveFileId: bookId }, { id: bookId }, { title: bookId }],
    },
  });

  if (!book) return [];

  let queryVector: number[] = [];
  try {
    const embResult = await generateEmbedding(query);
    queryVector = embResult.vector;
  } catch {
    /* Fallback if embedding service unavailable */
  }

  // Attempt pgvector similarity search if query vector generated
  if (queryVector.length > 0) {
    try {
      const vectorStr = `[${queryVector.join(",")}]`;
      const rawResults: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, page, "pageStart", "pageEnd", chapter, "sectionId", "tokenCount", "contentHash", content,
                (1 - (embedding <=> $1::vector)) as similarity
         FROM "ContentChunk"
         WHERE "bookId" = $2 AND "isStale" = false AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector ASC
         LIMIT $3;`,
        vectorStr,
        book.id,
        limit
      );

      if (Array.isArray(rawResults) && rawResults.length > 0) {
        return rawResults.map((r) => ({
          id: r.id,
          page: Number(r.pageStart || r.page || 1),
          pageStart: Number(r.pageStart || r.page || 1),
          pageEnd: Number(r.pageEnd || r.page || 1),
          chapter: r.chapter || null,
          sectionId: r.sectionId || null,
          tokenCount: Number(r.tokenCount || 0),
          contentHash: r.contentHash || null,
          content: r.content,
          similarity: parseFloat(r.similarity ?? 1),
        }));
      }
    } catch {
      /* Fallback to keyword search */
    }
  }

  // Fallback search: Keyword matching on non-stale chunks
  const term = query.trim().split(/\s+/)[0] || query;
  const chunks = await prisma.contentChunk.findMany({
    where: {
      bookId: book.id,
      isStale: false,
      content: { contains: term },
    },
    take: limit,
    orderBy: { pageStart: "asc" },
  });

  if (chunks.length > 0) {
    return chunks.map((c) => ({
      id: c.id,
      page: c.pageStart,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      chapter: c.chapter,
      sectionId: c.sectionId,
      tokenCount: c.tokenCount,
      contentHash: c.contentHash,
      content: c.content,
      similarity: 0.85,
    }));
  }

  // Default fallback: Initial non-stale chunks sorted by page start
  const initialChunks = await prisma.contentChunk.findMany({
    where: { bookId: book.id, isStale: false },
    take: limit,
    orderBy: { pageStart: "asc" },
  });

  return initialChunks.map((c) => ({
    id: c.id,
    page: c.pageStart,
    pageStart: c.pageStart,
    pageEnd: c.pageEnd,
    chapter: c.chapter,
    sectionId: c.sectionId,
    tokenCount: c.tokenCount,
    contentHash: c.contentHash,
    content: c.content,
    similarity: 0.7,
  }));
}
