import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { fetchThumbnail, publicThumbnailUrl } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/books/[id]/thumb — proxy Drive's auto-generated PDF thumbnail so it
 * can be used as an <img> cover. Falls back to public thumbnail endpoint if no OAuth token.
 * Returns 404 when no thumbnail exists, letting the UI fall back to a placeholder.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getAccessToken();

  try {
    if (token) {
      const res = await fetchThumbnail(token, id);
      if (res && res.body) {
        const headers = new Headers();
        headers.set("Content-Type", res.headers.get("content-type") ?? "image/jpeg");
        headers.set("Cache-Control", "private, max-age=86400");
        return new NextResponse(res.body, { status: 200, headers });
      }
    }

    // Fallback: Try fetching public thumbnail (for link-shared files or API key access)
    const pubRes = await fetch(publicThumbnailUrl(id, 400));
    if (pubRes.ok && pubRes.body) {
      const headers = new Headers();
      headers.set("Content-Type", pubRes.headers.get("content-type") ?? "image/jpeg");
      headers.set("Cache-Control", "public, max-age=86400");
      return new NextResponse(pubRes.body, { status: 200, headers });
    }

    return new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

