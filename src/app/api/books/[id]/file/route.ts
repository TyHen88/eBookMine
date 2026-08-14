import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { downloadFile, downloadPublicFile } from "@/lib/drive";
import { prisma } from "@/lib/db";
import { requireBookAccess } from "@/lib/authHelpers";
import { getLocalBookFilePath, streamLocalFile } from "@/lib/localStorage";

export const dynamic = "force-dynamic";

/**
 * GET /api/books/[id]/file — stream the PDF binary back to the browser
 * so pdf.js can render it. Handles local storage, OAuth Drive, and public Drive downloads.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const download = req.nextUrl.searchParams.get("download") === "1";
  const rawName = req.nextUrl.searchParams.get("name");

  try {
    const { allowed, response } = await requireBookAccess(id);
    if (!allowed && response) return response;

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

    // Forward the browser's Range header so pdf.js can fetch large PDFs
    // page-by-page (206 responses) instead of loading the whole file into memory.
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
    const token = await getAccessToken();
    let driveRes: Response;
    if (token) {
      driveRes = await downloadFile(token, driveFileId, range);
    } else {
      driveRes = await downloadPublicFile(driveFileId, range);
    }

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

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    const len = driveRes.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    const contentRange = driveRes.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${safeName}"`);
    }

    return new NextResponse(driveRes.body, { status: driveRes.status, headers });
  } catch (err) {
    console.error("Error streaming book file:", err);
    if (download) {
      return NextResponse.redirect(
        `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0&confirm=t`,
        307
      );
    }
    return new NextResponse(
      JSON.stringify({ error: "Failed to stream book file" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

