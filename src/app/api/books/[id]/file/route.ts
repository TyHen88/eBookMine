import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { downloadFile, downloadPublicFile } from "@/lib/drive";
import { prisma } from "@/lib/db";
import { requireBookAccess } from "@/lib/authHelpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/books/[id]/file — stream the PDF binary back to the browser
 * so pdf.js can render it. Handles both OAuth token and public Drive download fallbacks.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed, response } = await requireBookAccess(id);
  if (!allowed && response) return response;

  let driveFileId = id;
  const dbBook = await prisma.book.findFirst({
    where: { OR: [{ id }, { driveFileId: id }] },
    select: { driveFileId: true },
  }).catch(() => null);

  if (dbBook?.driveFileId) {
    driveFileId = dbBook.driveFileId;
  }

  // Forward the browser's Range header so pdf.js can fetch large PDFs
  // page-by-page (206 responses) instead of loading the whole file into memory.
  const range = req.headers.get("range") ?? undefined;
  const token = await getAccessToken();

  let driveRes: Response;
  if (token) {
    driveRes = await downloadFile(token, driveFileId, range);
  } else {
    driveRes = await downloadPublicFile(driveFileId, range);
  }

  if (!driveRes.ok) {
    return new NextResponse(null, { status: driveRes.status });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Accept-Ranges", "bytes");
  const len = driveRes.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  const contentRange = driveRes.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  return new NextResponse(driveRes.body, { status: driveRes.status, headers });
}

