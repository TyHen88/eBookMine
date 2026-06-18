import { getOrCreateAppFolder, listPdfFiles } from "./drive";
import { loadLibrary, saveLibrary, BookMeta } from "./metadata";
import { cleanTitle } from "./title";
import { categorize } from "./categorize";

/**
 * Build the merged book list for a given Google account: reconcile the Drive
 * folder against library.json (add new files, drop deleted ones, tidy titles,
 * backfill categories). When `persist` is true, changes are written back.
 *
 * Used by both the owner's authenticated route (persist) and the public
 * read-only route (no persist).
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

  if (changed && opts.persist) await saveLibrary(token, folderId, library);

  return Object.values(library.books).sort(
    (a, b) => +new Date(b.addedAt) - +new Date(a.addedAt)
  );
}
