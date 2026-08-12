import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { getHighlightList, addHighlight, removeHighlight } from "@/lib/readingService";

export const dynamic = "force-dynamic";

/**
 * GET /api/reading/highlights?bookId=...
 * POST /api/reading/highlights — create highlight
 * DELETE /api/reading/highlights?id=... — remove highlight
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "Missing bookId" }, { status: 400 });

  const highlights = await getHighlightList(user.id, bookId);
  return NextResponse.json({ highlights });
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { bookId, page, selectedText, color, position } = await req.json();
  if (!bookId || typeof page !== "number" || !selectedText) {
    return NextResponse.json({ error: "Invalid highlight payload" }, { status: 400 });
  }

  const highlight = await addHighlight(user.id, bookId, page, selectedText, color, position);
  return NextResponse.json({ highlight });
}

export async function DELETE(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing highlight id" }, { status: 400 });

  const ok = await removeHighlight(user.id, id);
  return NextResponse.json({ success: ok });
}
