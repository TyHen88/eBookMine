import {
  getOrCreateAppFolder,
  listPdfFiles,
  listPublicPdfFiles,
  DriveFile,
} from "./drive";
import {
  loadLibrary,
  loadPublicLibrary,
  saveLibrary,
  BookMeta,
  Library,
} from "./metadata";
import { cleanTitle } from "./title";
import { categorize } from "./categorize";

/**
 * Reconcile a Drive PDF listing against library.json in place: add entries for
 * new files, drop entries for deleted ones, tidy titles, backfill categories.
 * Returns the sorted book list and whether anything changed (so callers can
 * decide whether to persist). Pure — no network, no token.
 */
function reconcile(
  files: DriveFile[],
  library: Library
): { books: BookMeta[]; changed: boolean } {
  let changed = false;

  // Surface PDFs present in Drive that aren't yet in metadata.
  for (const f of files) {
    if (!library.books[f.id]) {
      library.books[f.id] = {
        id: f.id,
        title: cleanTitle(f.name),
        author: "Unknown",
        fileName: f.name,
        pageCount: 0,
        category: categorize(f.name),
        tags: [],
        favorite: false,
        cover: null,
        addedAt: f.createdTime ?? new Date().toISOString(),
        lastPage: 1,
        bookmarks: [],
        sizeBytes: f.size ? parseInt(f.size, 10) : 0,
      };
      changed = true;
    }
  }

  // Drop metadata entries whose Drive file no longer exists.
  const liveIds = new Set(files.map((f) => f.id));
  for (const id of Object.keys(library.books)) {
    if (!liveIds.has(id)) {
      delete library.books[id];
      changed = true;
    }
  }

  // Auto-tidy titles (idempotent) and backfill categories.
  for (const book of Object.values(library.books)) {
    const tidied = cleanTitle(book.title);
    if (tidied !== book.title) {
      book.title = tidied;
      changed = true;
    }
    if (!book.category) {
      book.category = categorize(`${book.title} ${book.fileName}`);
      changed = true;
    }
  }

  const books = Object.values(library.books).sort(
    (a, b) => +new Date(b.addedAt) - +new Date(a.addedAt)
  );
  return { books, changed };
}

/**
 * Build the merged book list for a signed-in owner and (optionally) persist any
 * reconciliation changes back to their Drive.
 */
export async function getMergedBooks(
  token: string,
  opts: { persist?: boolean } = {}
): Promise<BookMeta[]> {
  const folderId = await getOrCreateAppFolder(token);
  const [files, library] = await Promise.all([
    listPdfFiles(token, folderId),
    loadLibrary(token, folderId),
  ]);

  const { books, changed } = reconcile(files, library);
  if (changed && opts.persist) await saveLibrary(token, folderId, library);
  return books;
}

/**
 * Build the read-only book list from a publicly-shared folder using only the
 * API key (no OAuth token). Never persists.
 */
export async function getPublicBooks(folderId: string): Promise<BookMeta[]> {
  const [files, library] = await Promise.all([
    listPublicPdfFiles(folderId),
    loadPublicLibrary(folderId),
  ]);
  return reconcile(files, library).books;
}
