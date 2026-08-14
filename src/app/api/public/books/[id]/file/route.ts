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
      if (download && driveFileId) {
        return NextResponse.redirect(
          `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&authuser=0&confirm=t`,
          307
        );
      }
      return new NextResponse(
        JSON.stringify({ error: "PDF file stream unavailable in Google Drive" }),
        { status: driveRes.status || 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await driveRes.arrayBuffer();

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Content-Length", String(data.byteLength));
    const contentRange = driveRes.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${safeName}"`);
    }
    return new NextResponse(data, { status: driveRes.status, headers });
  } catch (err: any) {
    console.error("Error streaming public book file:", err);
    if (download) {
      return NextResponse.redirect(
        `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0&confirm=t`,
        307
      );
    }
    return new NextResponse(
      JSON.stringify({
        error: "Failed to stream public book file",
        details: err?.message || String(err),
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
}
