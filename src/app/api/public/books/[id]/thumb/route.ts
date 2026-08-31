import { NextRequest, NextResponse } from "next/server";
import { publicThumbnailUrl } from "@/lib/drive";
import { prisma } from "@/lib/db";

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
    const dbBook = await prisma.book
      .findFirst({
        where: { OR: [{ id }, { driveFileId: id }] },
        select: { driveFileId: true, coverUrl: true },
      })
      .catch(() => null);

    if (dbBook?.coverUrl) {
      return NextResponse.redirect(dbBook.coverUrl);
    }

    const fileId = dbBook?.driveFileId || id;
    const res = await fetch(publicThumbnailUrl(fileId, 400));
    if (!res.ok || !res.body) return new NextResponse(null, { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") ?? "image/jpeg");
    headers.set("Cache-Control", "public, max-age=86400");
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
