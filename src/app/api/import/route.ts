import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import {
  getOrCreateAppFolder,
  moveFileToFolder,
  copyFileToFolder,
  DriveFile,
} from "@/lib/drive";
import { loadLibrary, saveLibrary, BookMeta } from "@/lib/metadata";
import { cleanTitle } from "@/lib/title";
import { categorize } from "@/lib/categorize";

export const dynamic = "force-dynamic";

/**
 * POST /api/import — import PDFs the user selected via the Google Picker.
 * Body: { ids: string[] }. Each file is moved into the eBookMine folder
 * (falling back to a copy if a move is not permitted) and added to the library.
 */
export async function POST(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No file ids" }, { status: 400 });
  }

  const folderId = await getOrCreateAppFolder(token);
  const library = await loadLibrary(token, folderId);

  const imported: BookMeta[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of ids) {
    try {
      let file: DriveFile;
      try {
        file = await moveFileToFolder(token, id, folderId);
      } catch {
        // A move may be disallowed for files the app only has read access to;
        // copying produces an app-owned file in the folder instead.
        file = await copyFileToFolder(token, id, folderId);
      }

      const book: BookMeta = library.books[file.id] ?? {
        id: file.id,
        title: cleanTitle(file.name),
        author: "Unknown",
        fileName: file.name,
        pageCount: 0,
        category: categorize(file.name),
        tags: [],
        favorite: false,
        cover: null,
        addedAt: file.createdTime ?? new Date().toISOString(),
        lastPage: 1,
        bookmarks: [],
        sizeBytes: file.size ? parseInt(file.size, 10) : 0,
      };
      library.books[book.id] = book;
      imported.push(book);
    } catch (err: any) {
      failed.push({ id, error: err?.message ?? "Failed" });
    }
  }

  if (imported.length > 0) await saveLibrary(token, folderId, library);

  return NextResponse.json({ imported, failed });
}
