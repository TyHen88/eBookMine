import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { downloadFile } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/books/[id]/file — stream the PDF binary back to the browser
 * so pdf.js can render it without exposing the Drive token client-side.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const driveRes = await downloadFile(token, id);
  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Cache-Control", "private, max-age=3600");
  const len = driveRes.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new NextResponse(driveRes.body, { status: 200, headers });
}
