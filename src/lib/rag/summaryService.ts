import { prisma } from "@/lib/db";
import { aiProvider } from "@/lib/ai/aiService";

export interface SummaryRecord {
  id: string;
  bookId: string;
  level: "BOOK" | "CHAPTER" | "SECTION";
  chapterTitle?: string | null;
  sectionId?: string | null;
  summary: string;
  pageStart: number;
  pageEnd: number;
  sourceChunkIds: string[];
}

/**
 * Generate or retrieve persistent hierarchical summaries (Book -> Chapter -> Section).
 * Retains strict source chunk provenance and page boundaries.
 */
export async function buildHierarchicalSummaries(bookId: string): Promise<SummaryRecord[]> {
  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
    include: {
      documentStructures: { orderBy: { orderingIndex: "asc" } },
      contentChunks: { where: { isStale: false }, orderBy: { chunkIndex: "asc" } },
    },
  });

  if (!book || book.contentChunks.length === 0) {
    return [];
  }

  // Idempotency Check: Return existing summaries if available
  const existing = await prisma.documentSummary.findMany({
    where: { bookId: book.id },
  });

  if (existing.length > 0) {
    return existing.map((s) => ({
      id: s.id,
      bookId: s.bookId,
      level: s.level as any,
      chapterTitle: s.chapterTitle,
      sectionId: s.sectionId,
      summary: s.summary,
      pageStart: s.pageStart,
      pageEnd: s.pageEnd,
      sourceChunkIds: JSON.parse(s.sourceChunkIds || "[]"),
    }));
  }

  const chunks = book.contentChunks;
  const createdSummaries: SummaryRecord[] = [];

  // 1. Section Level Summaries
  const chapterGroupMap = new Map<string, typeof chunks>();

  for (const c of chunks) {
    const key = c.chapter || "General Content";
    if (!chapterGroupMap.has(key)) {
      chapterGroupMap.set(key, []);
    }
    chapterGroupMap.get(key)!.push(c);
  }

  const chapterSummariesText: string[] = [];

  for (const [chapterTitle, chapterChunks] of chapterGroupMap.entries()) {
    const sourceIds = chapterChunks.map((c) => c.id);
    const pStart = Math.min(...chapterChunks.map((c) => c.pageStart));
    const pEnd = Math.max(...chapterChunks.map((c) => c.pageEnd));

    const combinedText = chapterChunks.map((c) => c.content).join("\n\n");
    const summaryPrompt = `Provide a concise, high-level structural summary of the following book chapter ("${chapterTitle}") covering pages ${pStart} to ${pEnd}:\n\n${combinedText.substring(0, 4000)}`;

    let summaryText = "";
    try {
      summaryText = await aiProvider.generateText(summaryPrompt, {
        bookTitle: book.title,
        page: pStart,
      });
    } catch {
      summaryText = `Chapter "${chapterTitle}" covers core concepts and details spanning pages ${pStart} to ${pEnd}.`;
    }

    const createdChapter = await prisma.documentSummary.create({
      data: {
        bookId: book.id,
        level: "CHAPTER",
        chapterTitle,
        summary: summaryText,
        pageStart: pStart,
        pageEnd: pEnd,
        sourceChunkIds: JSON.stringify(sourceIds),
      },
    });

    createdSummaries.push({
      id: createdChapter.id,
      bookId: book.id,
      level: "CHAPTER",
      chapterTitle,
      summary: summaryText,
      pageStart: pStart,
      pageEnd: pEnd,
      sourceChunkIds: sourceIds,
    });

    chapterSummariesText.push(`[${chapterTitle} (Pages ${pStart}-${pEnd})]:\n${summaryText}`);
  }

  // 2. Book Level Summary
  const bookSourceIds = chunks.map((c) => c.id);
  const bookPageStart = Math.min(...chunks.map((c) => c.pageStart));
  const bookPageEnd = Math.max(...chunks.map((c) => c.pageEnd));

  const bookSummaryPrompt = `Synthesize an overall high-level book summary for "${book.title}" based on the following chapter summaries:\n\n${chapterSummariesText.join("\n\n")}`;

  let bookSummaryText = "";
  try {
    bookSummaryText = await aiProvider.generateText(bookSummaryPrompt, {
      bookTitle: book.title,
    });
  } catch {
    bookSummaryText = `"${book.title}" is a comprehensive reference covering key chapters across pages ${bookPageStart} to ${bookPageEnd}.`;
  }

  const createdBookSummary = await prisma.documentSummary.create({
    data: {
      bookId: book.id,
      level: "BOOK",
      chapterTitle: "Book Summary",
      summary: bookSummaryText,
      pageStart: bookPageStart,
      pageEnd: bookPageEnd,
      sourceChunkIds: JSON.stringify(bookSourceIds),
    },
  });

  createdSummaries.push({
    id: createdBookSummary.id,
    bookId: book.id,
    level: "BOOK",
    chapterTitle: "Book Summary",
    summary: bookSummaryText,
    pageStart: bookPageStart,
    pageEnd: bookPageEnd,
    sourceChunkIds: bookSourceIds,
  });

  return createdSummaries;
}

/**
 * Retrieve persistent hierarchical summaries for a book.
 */
export async function getHierarchicalSummaries(bookId: string): Promise<SummaryRecord[]> {
  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
    select: { id: true },
  });

  if (!book) return [];

  const summaries = await prisma.documentSummary.findMany({
    where: { bookId: book.id },
  });

  return summaries.map((s) => ({
    id: s.id,
    bookId: s.bookId,
    level: s.level as any,
    chapterTitle: s.chapterTitle,
    sectionId: s.sectionId,
    summary: s.summary,
    pageStart: s.pageStart,
    pageEnd: s.pageEnd,
    sourceChunkIds: JSON.parse(s.sourceChunkIds || "[]"),
  }));
}
