import { NextRequest, NextResponse } from "next/server";
import { downloadPublicFile } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/books/[id]/file — stream a book from the owner's publicly-
 * shared Drive to any visitor, using only the API key. Add ?download=1 to force
 * a download (Content-Disposition: attachment).
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
    const driveRes = await downloadPublicFile(id);
    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Cache-Control", "public, max-age=3600");
    const len = driveRes.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${safeName}"`);
    }
    return new NextResponse(driveRes.body, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
