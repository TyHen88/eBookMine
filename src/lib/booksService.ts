import { prisma } from "@/lib/db";
import { BookMeta, Bookmark as ClientBookmark } from "@/lib/types";
import { getOrCreateAppFolder } from "@/lib/drive";
import { syncFromDrive, syncFromPublicDrive, slugify } from "@/lib/bookSyncService";
import { cleanTitle } from "@/lib/title";

/**
 * Transforms a Prisma Book record (with relations) into the client-facing BookMeta interface.
 */
export function transformDbBookToMeta(
  dbBook: any,
  userId?: string
): BookMeta {
  const authorName =
    dbBook.authors && dbBook.authors.length > 0
      ? dbBook.authors[0].author?.name ?? "Unknown"
      : "Unknown";

  const categoryName =
    dbBook.categories && dbBook.categories.length > 0
      ? dbBook.categories[0].category?.name ?? "Other"
      : "Other";

  const tagList =
    dbBook.categories && dbBook.categories.length > 0
      ? dbBook.categories.map((c: any) => c.category?.name).filter(Boolean)
      : [];

  const userProgress =
    dbBook.readingProgresses && dbBook.readingProgresses.length > 0
      ? dbBook.readingProgresses[0]
      : null;

  const userBookmarks: ClientBookmark[] =
    dbBook.bookmarks && dbBook.bookmarks.length > 0
      ? dbBook.bookmarks.map((b: any) => ({
          page: b.page,
          label: b.title || `Page ${b.page}`,
          createdAt:
            b.createdAt instanceof Date
              ? b.createdAt.toISOString()
              : String(b.createdAt ?? new Date().toISOString()),
        }))
      : [];

  const addedAtIso =
    dbBook.createdAt instanceof Date
      ? dbBook.createdAt.toISOString()
      : String(dbBook.createdAt ?? new Date().toISOString());

  return {
    id: dbBook.driveFileId || dbBook.id,
    title: dbBook.title,
    author: authorName,
    fileName: dbBook.fileName || `${dbBook.title}.pdf`,
    pageCount: dbBook.pageCount || 0,
    category: categoryName,
    tags: tagList,
    favorite: Boolean(dbBook.favorite),
    cover: dbBook.coverUrl || null,
    addedAt: addedAtIso,
    lastPage: userProgress?.currentPage || 1,
    bookmarks: userBookmarks,
    sizeBytes: Number(dbBook.sizeBytes || 0),
  };
}

const COMMON_BOOK_INCLUDE = (userId?: string) => ({
  authors: { include: { author: true } },
  categories: { include: { category: true } },
  readingProgresses: userId
    ? { where: { userId } }
    : { take: 1 },
  bookmarks: userId
    ? { where: { userId } }
    : { take: 50 },
});

/**
 * Fetch books from PostgreSQL for authenticated owner/user.
 * Automatically triggers background drive sync on empty database.
 */
export async function getMergedBooks(
  token: string,
  opts: { userId?: string; persist?: boolean } = {}
): Promise<BookMeta[]> {
  try {
    let dbBooks = await prisma.book.findMany({
      include: COMMON_BOOK_INCLUDE(opts.userId),
      orderBy: { createdAt: "desc" },
    });

    // If database is empty, sync from Google Drive on first request
    if (dbBooks.length === 0 && token) {
      try {
        const folderId = await getOrCreateAppFolder(token);
        await syncFromDrive(token, folderId, opts.userId);
        dbBooks = await prisma.book.findMany({
          include: COMMON_BOOK_INCLUDE(opts.userId),
          orderBy: { createdAt: "desc" },
        });
      } catch (syncErr) {
        console.error("Initial Drive sync error:", syncErr);
      }
    }

    return dbBooks.map((b) => transformDbBookToMeta(b, opts.userId));
  } catch (err) {
    console.error("Error in getMergedBooks:", err);
    return [];
  }
}

/**
 * Fetch public/published books from PostgreSQL for unauthenticated visitors.
 */
export async function getPublicBooks(folderId: string): Promise<BookMeta[]> {
  try {
    let dbBooks = await prisma.book.findMany({
      where: {
        published: true,
      },
      include: COMMON_BOOK_INCLUDE(),
      orderBy: { createdAt: "desc" },
    });

    if (dbBooks.length === 0 && folderId) {
      try {
        await syncFromPublicDrive(folderId);
        dbBooks = await prisma.book.findMany({
          where: { published: true },
          include: COMMON_BOOK_INCLUDE(),
          orderBy: { createdAt: "desc" },
        });
      } catch (syncErr) {
        console.error("Public drive sync error:", syncErr);
      }
    }

    return dbBooks.map((b) => transformDbBookToMeta(b));
  } catch (err) {
    console.error("Error in getPublicBooks:", err);
    return [];
  }
}

/**
 * Find a single book by PostgreSQL ID or Drive File ID.
 */
export async function getDbBookById(
  idOrDriveFileId: string,
  userId?: string
): Promise<BookMeta | null> {
  const dbBook = await prisma.book.findFirst({
    where: {
      OR: [{ driveFileId: idOrDriveFileId }, { id: idOrDriveFileId }],
    },
    include: COMMON_BOOK_INCLUDE(userId),
  });

  if (!dbBook) return null;
  return transformDbBookToMeta(dbBook, userId);
}

/**
 * Create or upsert a new Book record in PostgreSQL.
 */
export async function createDbBook(data: {
  driveFileId: string;
  title: string;
  fileName: string;
  author?: string;
  category?: string;
  pageCount?: number;
  sizeBytes?: number;
  coverUrl?: string | null;
  userId?: string;
}): Promise<BookMeta> {
  const authorName =
    data.author && data.author.trim() && data.author.trim().toLowerCase() !== "unknown"
      ? data.author.trim()
      : "Unknown";
  const author = await prisma.author.upsert({
    where: { name: authorName },
    update: {},
    create: { name: authorName },
  });

  const catName = data.category && data.category.trim() ? data.category.trim() : "Other";
  const catSlug = slugify(catName);
  const category = await prisma.category.upsert({
    where: { slug: catSlug },
    update: { name: catName },
    create: { name: catName, slug: catSlug },
  });

  const existing = await prisma.book.findFirst({
    where: { driveFileId: data.driveFileId },
  });

  const bookData = {
    driveFileId: data.driveFileId,
    title: cleanTitle(data.title || data.fileName),
    fileName: data.fileName,
    pageCount: data.pageCount || 0,
    sizeBytes: BigInt(data.sizeBytes || 0),
    coverUrl: data.coverUrl || null,
    published: true,
    visibility: "PUBLIC",
  };

  let dbBook;
  if (existing) {
    dbBook = await prisma.book.update({
      where: { id: existing.id },
      data: bookData,
    });
  } else {
    dbBook = await prisma.book.create({
      data: bookData,
    });
  }

  await prisma.bookAuthor.upsert({
    where: {
      bookId_authorId: { bookId: dbBook.id, authorId: author.id },
    },
    update: {},
    create: { bookId: dbBook.id, authorId: author.id },
  });

  await prisma.bookCategory.upsert({
    where: {
      bookId_categoryId: { bookId: dbBook.id, categoryId: category.id },
    },
    update: {},
    create: { bookId: dbBook.id, categoryId: category.id },
  });

  return getDbBookById(dbBook.id, data.userId) as Promise<BookMeta>;
}

/**
 * Update mutable metadata, reading progress, and bookmarks for a book in PostgreSQL.
 */
export async function updateDbBook(
  idOrDriveFileId: string,
  patch: Partial<BookMeta> & { renameFileTo?: string },
  userId?: string
): Promise<BookMeta | null> {
  const existing = await prisma.book.findFirst({
    where: {
      OR: [{ driveFileId: idOrDriveFileId }, { id: idOrDriveFileId }],
    },
  });

  if (!existing) return null;

  const updateData: any = {};
  if (typeof patch.title === "string") updateData.title = cleanTitle(patch.title);
  if (typeof patch.favorite === "boolean") updateData.favorite = patch.favorite;
  if (typeof patch.cover === "string" || patch.cover === null) updateData.coverUrl = patch.cover;
  if (typeof patch.pageCount === "number" && patch.pageCount > 0) updateData.pageCount = patch.pageCount;
  if (typeof patch.renameFileTo === "string" && patch.renameFileTo.trim()) {
    updateData.fileName = patch.renameFileTo.endsWith(".pdf")
      ? patch.renameFileTo
      : `${patch.renameFileTo}.pdf`;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.book.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  // Author update
  if (typeof patch.author === "string" && patch.author.trim()) {
    const authorName = patch.author.trim();
    const author = await prisma.author.upsert({
      where: { name: authorName },
      update: {},
      create: { name: authorName },
    });

    await prisma.bookAuthor.deleteMany({ where: { bookId: existing.id } });
    await prisma.bookAuthor.create({
      data: { bookId: existing.id, authorId: author.id },
    });
  }

  // Category update
  if (typeof patch.category === "string" && patch.category.trim()) {
    const catName = patch.category.trim();
    const catSlug = slugify(catName);
    const category = await prisma.category.upsert({
      where: { slug: catSlug },
      update: { name: catName },
      create: { name: catName, slug: catSlug },
    });

    await prisma.bookCategory.deleteMany({ where: { bookId: existing.id } });
    await prisma.bookCategory.create({
      data: { bookId: existing.id, categoryId: category.id },
    });
  }

  // Reading progress update
  if (userId && typeof patch.lastPage === "number" && patch.lastPage > 0) {
    const total = patch.pageCount || existing.pageCount || 1;
    const pct = Math.min(100, (patch.lastPage / total) * 100);

    await prisma.readingProgress.upsert({
      where: {
        userId_bookId: { userId, bookId: existing.id },
      },
      update: {
        currentPage: patch.lastPage,
        totalPages: total,
        progressPercentage: parseFloat(pct.toFixed(2)),
        lastReadAt: new Date(),
      },
      create: {
        userId,
        bookId: existing.id,
        currentPage: patch.lastPage,
        totalPages: total,
        progressPercentage: parseFloat(pct.toFixed(2)),
      },
    });
  }

  // Bookmarks update
  if (userId && Array.isArray(patch.bookmarks)) {
    await prisma.bookmark.deleteMany({
      where: { userId, bookId: existing.id },
    });

    for (const bm of patch.bookmarks) {
      await prisma.bookmark.create({
        data: {
          userId,
          bookId: existing.id,
          page: bm.page,
          title: bm.label || `Page ${bm.page}`,
        },
      });
    }
  }

  return getDbBookById(existing.id, userId);
}

/**
 * Delete book metadata from PostgreSQL database.
 */
export async function deleteDbBook(idOrDriveFileId: string): Promise<boolean> {
  try {
    const existing = await prisma.book.findFirst({
      where: {
        OR: [{ driveFileId: idOrDriveFileId }, { id: idOrDriveFileId }],
      },
    });

    if (!existing) return false;

    await prisma.book.delete({ where: { id: existing.id } });
    return true;
  } catch (err) {
    console.error("Error deleting book from DB:", err);
    return false;
  }
}
