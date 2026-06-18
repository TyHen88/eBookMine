import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { fetchThumbnail } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/books/[id]/thumb — proxy Drive's auto-generated PDF thumbnail so it
 * can be used as an <img> cover (the raw thumbnailLink needs an auth header).
 * Returns 404 when no thumbnail exists, letting the UI fall back to a placeholder.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAccessToken();
  if (!token) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  try {
    const res = await fetchThumbnail(token, id);
    if (!res || !res.body) return new NextResponse(null, { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") ?? "image/jpeg");
    headers.set("Cache-Control", "private, max-age=86400");
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
