import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { getNoteList, saveNote, removeNote } from "@/lib/readingService";

export const dynamic = "force-dynamic";

/**
 * GET /api/reading/notes?bookId=...&query=...
 * POST /api/reading/notes — create or edit note
 * DELETE /api/reading/notes?id=... — delete note
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "Missing bookId" }, { status: 400 });

  const query = req.nextUrl.searchParams.get("query") ?? undefined;
  const notes = await getNoteList(user.id, bookId, query);
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { bookId, page, content, id } = await req.json();
  if (!bookId || typeof page !== "number" || typeof content !== "string") {
    return NextResponse.json({ error: "Invalid note payload" }, { status: 400 });
  }

  const note = await saveNote(user.id, bookId, page, content, id);
  return NextResponse.json({ note });
}

export async function DELETE(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing note id" }, { status: 400 });

  const ok = await removeNote(user.id, id);
  return NextResponse.json({ success: ok });
}
