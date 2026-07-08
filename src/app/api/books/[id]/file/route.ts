import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { downloadFile } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/books/[id]/file — stream the PDF binary back to the browser
 * so pdf.js can render it without exposing the Drive token client-side.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Forward the browser's Range header so pdf.js can fetch large PDFs
  // page-by-page (206 responses) instead of loading the whole file into memory.
  const range = req.headers.get("range") ?? undefined;
  const driveRes = await downloadFile(token, id, range);

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
