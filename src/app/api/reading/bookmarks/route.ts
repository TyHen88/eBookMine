import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { getBookmarkList, addBookmark, removeBookmark } from "@/lib/readingService";

export const dynamic = "force-dynamic";

/**
 * GET /api/reading/bookmarks?bookId=...
 * POST /api/reading/bookmarks — create bookmark
 * DELETE /api/reading/bookmarks?id=... — remove bookmark
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "Missing bookId" }, { status: 400 });

  const bookmarks = await getBookmarkList(user.id, bookId);
  return NextResponse.json({ bookmarks });
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { bookId, page, title } = await req.json();
  if (!bookId || typeof page !== "number") {
    return NextResponse.json({ error: "Invalid bookmark parameters" }, { status: 400 });
  }

  const bookmark = await addBookmark(user.id, bookId, page, title);
  return NextResponse.json({ bookmark });
}

export async function DELETE(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing bookmark id" }, { status: 400 });

  const ok = await removeBookmark(user.id, id);
  return NextResponse.json({ success: ok });
}
