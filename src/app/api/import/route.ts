import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateAppFolder,
  moveFileToFolder,
  copyFileToFolder,
  DriveFile,
} from "@/lib/drive";
import { createDbBook } from "@/lib/booksService";
import { requireAuth } from "@/lib/authHelpers";
import { cleanTitle } from "@/lib/title";
import { categorize } from "@/lib/categorize";
import { BookMeta } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/import — import PDFs selected via Google Picker into eBookMine folder
 * and create Book records in Neon PostgreSQL.
 */
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const token = session.accessToken;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No file ids" }, { status: 400 });
  }

  const folderId = await getOrCreateAppFolder(token);

  const imported: BookMeta[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of ids) {
    try {
      let file: DriveFile;
      try {
        file = await moveFileToFolder(token, id, folderId);
      } catch {
        file = await copyFileToFolder(token, id, folderId);
      }

      const book = await createDbBook({
        driveFileId: file.id,
        title: cleanTitle(file.name),
        fileName: file.name,
        author: "Unknown",
        category: categorize(file.name),
        pageCount: 0,
        sizeBytes: file.size ? parseInt(file.size, 10) : 0,
        userId: session.user?.id,
      });

      imported.push(book);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      failed.push({ id, error: msg });
    }
  }

  return NextResponse.json({ imported, failed });
}
