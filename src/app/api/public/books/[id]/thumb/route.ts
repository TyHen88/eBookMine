import { NextRequest, NextResponse } from "next/server";
import { getOwnerAccessToken } from "@/lib/owner";
import { fetchThumbnail } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/books/[id]/thumb — proxy Drive's PDF thumbnail (owner token)
 * so public covers render as <img>. 404 when unavailable -> UI placeholder.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getOwnerAccessToken();
  if (!token) return new NextResponse(null, { status: 503 });

  const { id } = await params;
  try {
    const res = await fetchThumbnail(token, id);
    if (!res || !res.body) return new NextResponse(null, { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") ?? "image/jpeg");
    headers.set("Cache-Control", "public, max-age=86400");
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
