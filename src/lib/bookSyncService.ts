import { prisma } from "@/lib/db";
import { Library, loadLibrary, loadPublicLibrary } from "@/lib/metadata";

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

  const processBook = async (book: (typeof books)[0]) => {
    try {
      if (!book.id) return;

      // 1. Author upsert
      const authorName =
        book.author &&
        book.author.trim() &&
        book.author.trim().toLowerCase() !== "unknown"
          ? book.author.trim()
          : "Unknown";

      const author = await prisma.author.upsert({
        where: { name: authorName },
        update: {},
        create: { name: authorName },
      });

      // 2. Category upsert
      const catName =
        book.category && book.category.trim()
          ? book.category.trim()
          : "Other";
      const catSlug = slugify(catName);

      const category = await prisma.category.upsert({
        where: { slug: catSlug },
        update: { name: catName },
        create: { name: catName, slug: catSlug },
      });

      // 3. Book upsert by driveFileId
      const driveFileId = book.id;
      const addedAtDate = new Date(book.addedAt);
      const validDate = Number.isNaN(addedAtDate.getTime())
        ? new Date()
        : addedAtDate;

      const existingBook = await prisma.book.findFirst({
        where: { driveFileId },
      });

      const bookData = {
        driveFileId,
        title: book.title || book.fileName || "Untitled",
        fileName: book.fileName || `${book.title || "book"}.pdf`,
        pageCount: book.pageCount || 0,
        sizeBytes: BigInt(book.sizeBytes || 0),
        coverUrl: book.cover || null,
        favorite: Boolean(book.favorite),
        createdAt: validDate,
      };

      let dbBook;
      if (existingBook) {
        dbBook = await prisma.book.update({
          where: { id: existingBook.id },
          data: bookData,
        });
        stats.updated++;
      } else {
        dbBook = await prisma.book.create({
          data: bookData,
        });
        stats.created++;
      }

      // 4. Link BookAuthor
      await prisma.bookAuthor.upsert({
        where: {
          bookId_authorId: {
            bookId: dbBook.id,
            authorId: author.id,
          },
        },
        update: {},
        create: {
          bookId: dbBook.id,
          authorId: author.id,
        },
      });

      // 5. Link BookCategory
      await prisma.bookCategory.upsert({
        where: {
          bookId_categoryId: {
            bookId: dbBook.id,
            categoryId: category.id,
          },
        },
        update: {},
        create: {
          bookId: dbBook.id,
          categoryId: category.id,
        },
      });

      // 6. Reading progress upsert (if userId provided and lastPage > 1)
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

      // 7. Bookmarks sync
      if (userId && Array.isArray(book.bookmarks) && book.bookmarks.length > 0) {
        for (const bm of book.bookmarks) {
          const bmTitle = bm.label || `Page ${bm.page}`;
          const existingBm = await prisma.bookmark.findFirst({
            where: {
              userId,
              bookId: dbBook.id,
              page: bm.page,
            },
          });

          if (!existingBm) {
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
      }

      stats.synced++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`Book ${book.id} (${book.title}): ${msg}`);
    }
  };

  // Process in concurrent batches of 15
  const BATCH_SIZE = 15;
  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((b) => processBook(b)));
    if ((i + BATCH_SIZE) % 150 === 0 || i + BATCH_SIZE >= books.length) {
      console.log(`Synced ${Math.min(i + BATCH_SIZE, books.length)} / ${books.length} books...`);
    }
  }

  return stats;
}

/**
 * Fetch library.json from Google Drive and synchronize all metadata to PostgreSQL.
 */
export async function syncFromDrive(
  token: string,
  folderId: string,
  userId?: string
): Promise<SyncStats> {
  const library = await loadLibrary(token, folderId);
  return syncLibraryMetadata(library, userId);
}

/**
 * Public library sync helper using API key (no OAuth token).
 */
export async function syncFromPublicDrive(
  folderId: string
): Promise<SyncStats> {
  const library = await loadPublicLibrary(folderId);
  return syncLibraryMetadata(library);
}
