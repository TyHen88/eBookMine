import { prisma } from "@/lib/db";
import { Library, loadLibrary, loadPublicLibrary } from "@/lib/metadata";
import { containsKhmer } from "@/lib/khmerHelper";

export interface SyncStats {
  total: number;
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "other"
  );
}

/**
 * Idempotently synchronize a Library object (from library.json) to Neon PostgreSQL.
 * Uses concurrent chunking for maximum migration speed.
 */
export async function syncLibraryMetadata(
  library: Library,
  userId?: string
): Promise<SyncStats> {
  const books = Object.values(library.books ?? {});
  const stats: SyncStats = {
    total: books.length,
    synced: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  if (books.length === 0) return stats;

  // 1. Prefetch all existing driveFileIds in a single bulk query
  const existingBooks = await prisma.book.findMany({
    select: { driveFileId: true },
  });
  const existingDriveIds = new Set(
    existingBooks.map((b) => b.driveFileId).filter(Boolean)
  );

  // 2. Identify only NEW books not yet in PostgreSQL
  const newBooks = books.filter((b) => b.id && !existingDriveIds.has(b.id));
  stats.synced = books.length - newBooks.length;

  if (newBooks.length === 0) {
    return stats;
  }

  // 3. In-memory author and category caches
  const authorCache = new Map<string, string>();
  const categoryCache = new Map<string, string>();

  const getOrCreateAuthor = async (rawName?: string) => {
    const authorName =
      rawName && rawName.trim() && rawName.trim().toLowerCase() !== "unknown"
        ? rawName.trim()
        : "Unknown";
    if (authorCache.has(authorName)) return authorCache.get(authorName)!;
    const author = await prisma.author.upsert({
      where: { name: authorName },
      update: {},
      create: { name: authorName },
    });
    authorCache.set(authorName, author.id);
    return author.id;
  };

  const getOrCreateCategory = async (rawName?: string) => {
    const catName = rawName && rawName.trim() ? rawName.trim() : "Other";
    const catSlug = slugify(catName);
    if (categoryCache.has(catSlug)) return categoryCache.get(catSlug)!;
    const category = await prisma.category.upsert({
      where: { slug: catSlug },
      update: { name: catName },
      create: { name: catName, slug: catSlug },
    });
    categoryCache.set(catSlug, category.id);
    return category.id;
  };

  const processNewBook = async (book: (typeof books)[0]) => {
    try {
      if (!book.id) return;

      const authorId = await getOrCreateAuthor(book.author);
      const categoryId = await getOrCreateCategory(book.category);

      const addedAtDate = new Date(book.addedAt);
      const validDate = Number.isNaN(addedAtDate.getTime()) ? new Date() : addedAtDate;

      const bookTitle = book.title || book.fileName || "Untitled";
      const detectedLang =
        (book as any).language ||
        (containsKhmer(bookTitle) || containsKhmer(book.fileName) ? "km" : "en");

      const dbBook = await prisma.book.create({
        data: {
          driveFileId: book.id,
          title: bookTitle,
          fileName: book.fileName || `${book.title || "book"}.pdf`,
          pageCount: book.pageCount || 0,
          sizeBytes: BigInt(book.sizeBytes || 0),
          coverUrl: book.cover || null,
          favorite: Boolean(book.favorite),
          language: detectedLang,
          published: true,
          visibility: "PUBLIC",
          createdAt: validDate,
        },
      });

      await prisma.bookAuthor.upsert({
        where: { bookId_authorId: { bookId: dbBook.id, authorId } },
        update: {},
        create: { bookId: dbBook.id, authorId },
      });

      await prisma.bookCategory.upsert({
        where: { bookId_categoryId: { bookId: dbBook.id, categoryId } },
        update: {},
        create: { bookId: dbBook.id, categoryId },
      });

      // Reading progress upsert (if userId provided and lastPage > 1)
      if (userId && book.lastPage > 1) {
        const pct =
          book.pageCount > 0
            ? Math.min(100, (book.lastPage / book.pageCount) * 100)
            : 0;

        await prisma.readingProgress.upsert({
          where: {
            userId_bookId: {
              userId,
              bookId: dbBook.id,
            },
          },
          update: {
            currentPage: book.lastPage,
            totalPages: book.pageCount || 0,
            progressPercentage: parseFloat(pct.toFixed(2)),
            lastReadAt: new Date(),
          },
          create: {
            userId,
            bookId: dbBook.id,
            currentPage: book.lastPage,
            totalPages: book.pageCount || 0,
            progressPercentage: parseFloat(pct.toFixed(2)),
          },
        });
      }

      // Bookmarks sync
      if (userId && Array.isArray(book.bookmarks) && book.bookmarks.length > 0) {
        for (const bm of book.bookmarks) {
          const bmTitle = bm.label || `Page ${bm.page}`;
          await prisma.bookmark.create({
            data: {
              userId,
              bookId: dbBook.id,
              page: bm.page,
              title: bmTitle,
            },
          });
        }
      }

      stats.created++;
      stats.synced++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`Book ${book.id} (${book.title}): ${msg}`);
    }
  };

  // Process in concurrent batches of 15
  const BATCH_SIZE = 15;
  for (let i = 0; i < newBooks.length; i += BATCH_SIZE) {
    const batch = newBooks.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((b) => processNewBook(b)));
  }

  return stats;
}

import { listPdfFiles, listPublicPdfFiles, DriveFile } from "@/lib/drive";
import { cleanTitle } from "@/lib/title";
import { categorize } from "@/lib/categorize";
import { memoryCache } from "@/lib/cache";

/**
 * Fast batch sync of physical PDF files from Google Drive into PostgreSQL.
 * Uses single-query prefetching, in-memory category caching, and parallel insertions.
 */
async function fastBatchSyncDrivePdfs(
  driveFiles: DriveFile[],
  stats: SyncStats
): Promise<void> {
  if (!driveFiles || driveFiles.length === 0) return;

  // 1. Single-query prefetch of all existing driveFileIds in database
  const existingBooks = await prisma.book.findMany({
    select: { driveFileId: true },
  });
  const existingIds = new Set(
    existingBooks.map((b) => b.driveFileId).filter(Boolean)
  );

  // 2. Filter down to ONLY new files not yet in the DB
  const newFiles = driveFiles.filter((f) => f.id && !existingIds.has(f.id));
  stats.total = (stats.total || 0) + driveFiles.length;
  stats.synced = (stats.synced || 0) + (driveFiles.length - newFiles.length);

  if (newFiles.length === 0) return;

  // 3. Ensure default Author exists once
  const author = await prisma.author.upsert({
    where: { name: "Unknown" },
    update: {},
    create: { name: "Unknown" },
  });

  // 4. In-memory category cache to avoid repeating category queries
  const categoryCache = new Map<string, string>(); // slug -> categoryId

  // Helper to get or create category with in-memory caching
  const getOrCreateCategory = async (rawName: string) => {
    const catName = rawName || "Other";
    const catSlug = slugify(catName);
    if (categoryCache.has(catSlug)) {
      return categoryCache.get(catSlug)!;
    }
    const cat = await prisma.category.upsert({
      where: { slug: catSlug },
      update: { name: catName },
      create: { name: catName, slug: catSlug },
    });
    categoryCache.set(catSlug, cat.id);
    return cat.id;
  };

  // 5. Process new books in concurrent chunks of 10
  const CHUNK_SIZE = 10;
  for (let i = 0; i < newFiles.length; i += CHUNK_SIZE) {
    const chunk = newFiles.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (file) => {
        try {
          const categoryId = await getOrCreateCategory(categorize(file.name));
          const bookTitle = cleanTitle(file.name.replace(/\.pdf$/i, ""));
          const detectedLang = containsKhmer(bookTitle) || containsKhmer(file.name) ? "km" : "en";
          const dbBook = await prisma.book.create({
            data: {
              driveFileId: file.id,
              title: bookTitle,
              fileName: file.name,
              sizeBytes: file.size ? BigInt(file.size) : BigInt(0),
              language: detectedLang,
              published: true,
              visibility: "PUBLIC",
            },
          });

          await prisma.bookAuthor.upsert({
            where: { bookId_authorId: { bookId: dbBook.id, authorId: author.id } },
            update: {},
            create: { bookId: dbBook.id, authorId: author.id },
          });

          await prisma.bookCategory.upsert({
            where: { bookId_categoryId: { bookId: dbBook.id, categoryId } },
            update: {},
            create: { bookId: dbBook.id, categoryId },
          });

          stats.created++;
          stats.synced++;
        } catch (fileErr) {
          const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
          stats.errors.push(`Drive File ${file.id} (${file.name}): ${msg}`);
        }
      })
    );
  }
}

/**
 * Fetch library.json AND list physical PDF files in Google Drive folder,
 * synchronizing all books into Neon PostgreSQL.
 */
export async function syncFromDrive(
  token: string,
  folderId: string,
  userId?: string
): Promise<SyncStats> {
  memoryCache.invalidate();

  let libraryStats: SyncStats = { total: 0, synced: 0, created: 0, updated: 0, errors: [] };
  try {
    const library = await loadLibrary(token, folderId);
    if (library.books && Object.keys(library.books).length > 0) {
      libraryStats = await syncLibraryMetadata(library, userId);
    }
  } catch (err) {
    console.warn("Could not load library.json from Drive:", err);
  }

  try {
    const driveFiles = await listPdfFiles(token, folderId);
    await fastBatchSyncDrivePdfs(driveFiles, libraryStats);
  } catch (scanErr) {
    console.error("Could not scan Drive folder for PDFs:", scanErr);
    const msg = scanErr instanceof Error ? scanErr.message : String(scanErr);
    libraryStats.errors.push(`Drive PDF listing: ${msg}`);
  }

  return libraryStats;
}

/**
 * Public library sync helper using API key (scans library.json and public Drive folder).
 */
export async function syncFromPublicDrive(
  folderId: string
): Promise<SyncStats> {
  memoryCache.invalidate();

  let libraryStats: SyncStats = { total: 0, synced: 0, created: 0, updated: 0, errors: [] };
  try {
    const library = await loadPublicLibrary(folderId);
    if (library.books && Object.keys(library.books).length > 0) {
      libraryStats = await syncLibraryMetadata(library);
    }
  } catch (err) {
    console.warn("Could not load public library.json:", err);
  }

  try {
    const driveFiles = await listPublicPdfFiles(folderId);
    await fastBatchSyncDrivePdfs(driveFiles, libraryStats);
  } catch (scanErr) {
    console.error("Could not scan public Drive folder:", scanErr);
    const msg = scanErr instanceof Error ? scanErr.message : String(scanErr);
    libraryStats.errors.push(`Public Drive PDF listing: ${msg}`);
  }

  return libraryStats;
}
