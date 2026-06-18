import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { getOrCreateAppFolder, deleteFile } from "@/lib/drive";
import { loadLibrary, saveLibrary } from "@/lib/metadata";
import { cleanTitle } from "@/lib/title";

export const dynamic = "force-dynamic";

/**
 * POST /api/books/bulk — apply one operation across many books in a single
 * library.json read/write (much faster + safer than N individual PATCHes).
 *
 * Body:
 *   { op: "tidyTitles" }
 *   { op: "addTag",    ids: string[], tag: string }
 *   { op: "removeTag", ids: string[], tag: string }
 *   { op: "delete",    ids: string[] }
 */
export async function POST(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { op, ids, tag } = await req.json();
  const folderId = await getOrCreateAppFolder(token);
  const library = await loadLibrary(token, folderId);
  const idSet = new Set<string>(Array.isArray(ids) ? ids : []);

  switch (op) {
    case "tidyTitles": {
      for (const book of Object.values(library.books)) {
        book.title = cleanTitle(book.fileName || book.title);
      }
      break;
    }
    case "addTag": {
      if (!tag) return NextResponse.json({ error: "Missing tag" }, { status: 400 });
      for (const id of idSet) {
        const b = library.books[id];
        if (b && !b.tags.includes(tag)) b.tags.push(tag);
      }
      break;
    }
    case "removeTag": {
      if (!tag) return NextResponse.json({ error: "Missing tag" }, { status: 400 });
      for (const id of idSet) {
        const b = library.books[id];
        if (b) b.tags = b.tags.filter((t) => t !== tag);
      }
      break;
    }
    case "delete": {
      for (const id of idSet) {
        try {
          await deleteFile(token, id);
          delete library.books[id];
        } catch {
          // Skip files that can't be deleted; leave their metadata in place.
        }
      }
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  }

  await saveLibrary(token, folderId, library);

  const books = Object.values(library.books).sort(
    (a, b) => +new Date(b.addedAt) - +new Date(a.addedAt)
  );
  return NextResponse.json({ books });
}
