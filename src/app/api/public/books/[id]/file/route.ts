import { NextRequest, NextResponse } from "next/server";
import { downloadPublicFile } from "@/lib/drive";
import { prisma } from "@/lib/db";
import { getLocalBookFilePath, streamLocalFile } from "@/lib/localStorage";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/books/[id]/file — stream a book from local storage or publicly-shared Drive.
 * Add ?download=1 to force a download (Content-Disposition: attachment).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const download = req.nextUrl.searchParams.get("download") === "1";
  const rawName = req.nextUrl.searchParams.get("name");
  const safeName = (rawName ? rawName.replace(/[^\w.\- ]+/g, "_") : id) + ".pdf";

  try {
    let driveFileId = id;
    const dbBook = await prisma.book.findFirst({
      where: { OR: [{ id }, { driveFileId: id }] },
      select: { driveFileId: true, title: true, fileName: true },
    }).catch(() => null);

    if (dbBook?.driveFileId) {
      driveFileId = dbBook.driveFileId;
    }

    const title = dbBook?.title || dbBook?.fileName || id;
    const safeName = (rawName || title).replace(/[^\w.\- ]+/g, "_") + ".pdf";
    const range = download ? undefined : req.headers.get("range") ?? undefined;

    // 1. Check if stored locally on disk
    const localPath = getLocalBookFilePath(driveFileId) || getLocalBookFilePath(id);
    if (localPath) {
      const response = streamLocalFile(localPath, range);
      if (download) {
        response.headers.set("Content-Disposition", `attachment; filename="${safeName}"`);
      }
      return response;
    }

    // 2. Fetch from Google Drive
    const driveRes = await downloadPublicFile(driveFileId, range);

    if (!driveRes.ok) {
      if (driveFileId) {
        return NextResponse.redirect(
          `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&authuser=0&confirm=t`,
          307
        );
      }
      return new NextResponse(null, { status: driveRes.status });
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Accept-Ranges", "bytes");
    const len = driveRes.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    const contentRange = driveRes.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${safeName}"`);
    }
    return new NextResponse(driveRes.body, { status: driveRes.status, headers });
  } catch (err) {
    console.error("Error streaming public book file:", err);
    return NextResponse.redirect(
      `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0&confirm=t`,
      307
    );
  }
}
