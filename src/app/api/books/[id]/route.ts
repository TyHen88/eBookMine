import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import {
  getOrCreateAppFolder,
  deleteFile,
  renameFile,
} from "@/lib/drive";
import { loadLibrary, saveLibrary } from "@/lib/metadata";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/books/[id] — update mutable metadata fields.
 * Body: partial { title, author, tags, favorite, lastPage, bookmarks }.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const patch = await req.json();
  const folderId = await getOrCreateAppFolder(token);
  const library = await loadLibrary(token, folderId);
  const book = library.books[id];
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = ["title", "author", "category", "tags", "favorite", "lastPage", "bookmarks"] as const;
  for (const key of allowed) {
    if (key in patch) (book as any)[key] = patch[key];
  }

  // If the title was renamed, also rename the Drive file for consistency.
  if (typeof patch.renameFileTo === "string" && patch.renameFileTo.trim()) {
    const newName = patch.renameFileTo.endsWith(".pdf")
      ? patch.renameFileTo
      : `${patch.renameFileTo}.pdf`;
    await renameFile(token, id, newName);
    book.fileName = newName;
  }

  library.books[id] = book;
  await saveLibrary(token, folderId, library);
  return NextResponse.json({ book });
}

/**
 * DELETE /api/books/[id] — remove the PDF from Drive and its metadata entry.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folderId = await getOrCreateAppFolder(token);
  await deleteFile(token, id);

  const library = await loadLibrary(token, folderId);
  delete library.books[id];
  await saveLibrary(token, folderId, library);

  return NextResponse.json({ ok: true });
}
