import { prisma } from "@/lib/db";
import { aiProvider } from "@/lib/ai/aiService";

export interface RetrievedChunk {
  id: string;
  page: number;
  chapter?: string | null;
  content: string;
  similarity: number;
}

/**
 * Retrieve top K relevant content chunks for a book query using vector similarity.
 */
export async function retrieveRelevantChunks(
  bookId: string,
  query: string,
  limit = 4
): Promise<RetrievedChunk[]> {
  const book = await prisma.book.findFirst({
    where: {
      OR: [{ driveFileId: bookId }, { id: bookId }],
    },
  });

  if (!book) return [];

  const queryVector = await aiProvider.generateEmbedding(query);
  const vectorStr = `[${queryVector.join(",")}]`;

  // Attempt vector similarity search using pgvector cosine distance operator (<=>)
  try {
    const rawResults: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, page, chapter, content,
              (1 - (embedding <=> $1::vector)) as similarity
       FROM "ContentChunk"
       WHERE "bookId" = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector ASC
       LIMIT $3;`,
      vectorStr,
      book.id,
      limit
    );

    if (Array.isArray(rawResults) && rawResults.length > 0) {
      return rawResults.map((r) => ({
        id: r.id,
        page: Number(r.page),
        chapter: r.chapter || null,
        content: r.content,
        similarity: parseFloat(r.similarity ?? 1),
      }));
    }
  } catch {
    /* fallback to keyword/page search if raw vector query is unsupported */
  }

  // Fallback search
  const chunks = await prisma.contentChunk.findMany({
    where: {
      bookId: book.id,
      content: { contains: query.split(" ")[0] || query, mode: "insensitive" },
    },
    take: limit,
    orderBy: { page: "asc" },
  });

  if (chunks.length > 0) {
    return chunks.map((c) => ({
      id: c.id,
      page: c.page,
      chapter: c.chapter,
      content: c.content,
      similarity: 0.85,
    }));
  }

  // Default: return top 4 initial chunks
  const initialChunks = await prisma.contentChunk.findMany({
    where: { bookId: book.id },
    take: limit,
    orderBy: { page: "asc" },
  });

  return initialChunks.map((c) => ({
    id: c.id,
    page: c.page,
    chapter: c.chapter,
    content: c.content,
    similarity: 0.7,
  }));
}
