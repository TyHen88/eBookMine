import { NextRequest, NextResponse } from "next/server";
import { publicThumbnailUrl } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/books/[id]/thumb — proxy Google's public thumbnail for a
 * shared PDF so covers render as <img>. No token needed (the file is link-
 * shared). 404 when unavailable -> UI placeholder.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetch(publicThumbnailUrl(id, 400));
    if (!res.ok || !res.body) return new NextResponse(null, { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") ?? "image/jpeg");
    headers.set("Cache-Control", "public, max-age=86400");
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
