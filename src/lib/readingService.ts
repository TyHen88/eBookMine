import { prisma } from "@/lib/db";
import { transformDbBookToMeta } from "@/lib/booksService";
import { BookMeta } from "@/lib/types";

export interface ProgressData {
  currentPage: number;
  totalPages: number;
  progressPercentage: number;
  lastReadAt: string;
  completedAt?: string | null;
}

export interface BookmarkData {
  id: string;
  page: number;
  title: string;
  createdAt: string;
}

export interface HighlightData {
  id: string;
  page: number;
  selectedText: string;
  color: string;
  position?: string | null;
  createdAt: string;
}

export interface NoteData {
  id: string;
  page: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContinueReadingItem {
  book: BookMeta;
  progress: ProgressData;
}

/**
 * Helper to resolve PostgreSQL Book record by id or driveFileId.
 */
async function resolveBook(idOrDriveFileId: string) {
  return prisma.book.findFirst({
    where: {
      OR: [{ driveFileId: idOrDriveFileId }, { id: idOrDriveFileId }],
    },
  });
}

/**
 * Save user reading progress to PostgreSQL.
 */
export async function saveProgress(
  userId: string,
  bookId: string,
  currentPage: number,
  totalPages: number
): Promise<ProgressData | null> {
  const book = await resolveBook(bookId);
  if (!book) return null;

  const validPages = totalPages > 0 ? totalPages : book.pageCount || 1;
  const pct = Math.min(100, Math.max(0, (currentPage / validPages) * 100));
  const isCompleted = currentPage >= validPages && validPages > 0;

  const result = await prisma.readingProgress.upsert({
    where: {
      userId_bookId: { userId, bookId: book.id },
    },
    update: {
      currentPage,
      totalPages: validPages,
      progressPercentage: parseFloat(pct.toFixed(2)),
      lastReadAt: new Date(),
      ...(isCompleted ? { completedAt: new Date() } : {}),
    },
    create: {
      userId,
      bookId: book.id,
      currentPage,
      totalPages: validPages,
      progressPercentage: parseFloat(pct.toFixed(2)),
      lastReadAt: new Date(),
      ...(isCompleted ? { completedAt: new Date() } : {}),
    },
  });

  return {
    currentPage: result.currentPage,
    totalPages: result.totalPages,
    progressPercentage: result.progressPercentage,
    lastReadAt: result.lastReadAt.toISOString(),
    completedAt: result.completedAt?.toISOString() || null,
  };
}

/**
 * Fetch "Continue Reading" shelf items for a user.
 */
export async function getContinueReading(
  userId: string,
  limit = 6
): Promise<ContinueReadingItem[]> {
  const items = await prisma.readingProgress.findMany({
    where: {
      userId,
      currentPage: { gt: 1 },
    },
    include: {
      book: {
        include: {
          authors: { include: { author: true } },
          categories: { include: { category: true } },
        },
      },
    },
    orderBy: { lastReadAt: "desc" },
    take: limit,
  });

  return items
    .filter((item) => item.book && item.currentPage < (item.totalPages || item.book.pageCount || 999999))
    .map((item) => ({
      book: transformDbBookToMeta(item.book, userId),
      progress: {
        currentPage: item.currentPage,
        totalPages: item.totalPages,
        progressPercentage: item.progressPercentage,
        lastReadAt: item.lastReadAt.toISOString(),
        completedAt: item.completedAt?.toISOString() || null,
      },
    }));
}

/**
 * Fetch user bookmarks for a book.
 */
export async function getBookmarkList(
  userId: string,
  bookId: string
): Promise<BookmarkData[]> {
  const book = await resolveBook(bookId);
  if (!book) return [];

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId, bookId: book.id },
    orderBy: { page: "asc" },
  });

  return bookmarks.map((b) => ({
    id: b.id,
    page: b.page,
    title: b.title || `Page ${b.page}`,
    createdAt: b.createdAt.toISOString(),
  }));
}

/**
 * Add a bookmark for a user and book.
 */
export async function addBookmark(
  userId: string,
  bookId: string,
  page: number,
  title?: string
): Promise<BookmarkData | null> {
  const book = await resolveBook(bookId);
  if (!book) return null;

  const existing = await prisma.bookmark.findFirst({
    where: { userId, bookId: book.id, page },
  });

  if (existing) {
    return {
      id: existing.id,
      page: existing.page,
      title: existing.title || `Page ${existing.page}`,
      createdAt: existing.createdAt.toISOString(),
    };
  }

  const bm = await prisma.bookmark.create({
    data: {
      userId,
      bookId: book.id,
      page,
      title: title || `Page ${page}`,
    },
  });

  return {
    id: bm.id,
    page: bm.page,
    title: bm.title || `Page ${bm.page}`,
    createdAt: bm.createdAt.toISOString(),
  };
}

/**
 * Remove a user's bookmark.
 */
export async function removeBookmark(
  userId: string,
  bookmarkId: string
): Promise<boolean> {
  try {
    const existing = await prisma.bookmark.findFirst({
      where: { id: bookmarkId, userId },
    });
    if (!existing) return false;

    await prisma.bookmark.delete({ where: { id: bookmarkId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch user highlights for a book.
 */
export async function getHighlightList(
  userId: string,
  bookId: string
): Promise<HighlightData[]> {
  const book = await resolveBook(bookId);
  if (!book) return [];

  const highlights = await prisma.highlight.findMany({
    where: { userId, bookId: book.id },
    orderBy: { page: "asc" },
  });

  return highlights.map((h) => ({
    id: h.id,
    page: h.page,
    selectedText: h.selectedText,
    color: h.color || "yellow",
    position: h.position || null,
    createdAt: h.createdAt.toISOString(),
  }));
}

/**
 * Create a highlight for a user.
 */
export async function addHighlight(
  userId: string,
  bookId: string,
  page: number,
  selectedText: string,
  color = "yellow",
  position?: string
): Promise<HighlightData | null> {
  const book = await resolveBook(bookId);
  if (!book) return null;

  const h = await prisma.highlight.create({
    data: {
      userId,
      bookId: book.id,
      page,
      selectedText,
      color,
      position: position || null,
    },
  });

  return {
    id: h.id,
    page: h.page,
    selectedText: h.selectedText,
    color: h.color || "yellow",
    position: h.position || null,
    createdAt: h.createdAt.toISOString(),
  };
}

/**
 * Remove a user highlight.
 */
export async function removeHighlight(
  userId: string,
  highlightId: string
): Promise<boolean> {
  try {
    const existing = await prisma.highlight.findFirst({
      where: { id: highlightId, userId },
    });
    if (!existing) return false;

    await prisma.highlight.delete({ where: { id: highlightId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch user notes for a book (with optional keyword search).
 */
export async function getNoteList(
  userId: string,
  bookId: string,
  query?: string
): Promise<NoteData[]> {
  const book = await resolveBook(bookId);
  if (!book) return [];

  const whereClause: any = { userId, bookId: book.id };
  if (query && query.trim()) {
    whereClause.content = { contains: query.trim(), mode: "insensitive" };
  }

  const notes = await prisma.note.findMany({
    where: whereClause,
    orderBy: { page: "asc" },
  });

  return notes.map((n) => ({
    id: n.id,
    page: n.page,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
}

/**
 * Create or edit a user note.
 */
export async function saveNote(
  userId: string,
  bookId: string,
  page: number,
  content: string,
  noteId?: string
): Promise<NoteData | null> {
  const book = await resolveBook(bookId);
  if (!book) return null;

  if (noteId) {
    const existing = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });
    if (existing) {
      const updated = await prisma.note.update({
        where: { id: noteId },
        data: { content, page },
      });
      return {
        id: updated.id,
        page: updated.page,
        content: updated.content,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    }
  }

  const created = await prisma.note.create({
    data: {
      userId,
      bookId: book.id,
      page,
      content,
    },
  });

  return {
    id: created.id,
    page: created.page,
    content: created.content,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

/**
 * Remove a user note.
 */
export async function removeNote(
  userId: string,
  noteId: string
): Promise<boolean> {
  try {
    const existing = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });
    if (!existing) return false;

    await prisma.note.delete({ where: { id: noteId } });
    return true;
  } catch {
    return false;
  }
}
