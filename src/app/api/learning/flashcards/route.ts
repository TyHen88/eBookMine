import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import {
  generateFlashcardsFromBook,
  reviewFlashcard,
} from "@/lib/learning/learningService";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/learning/flashcards?bookId=... — fetch due flashcards for user and book.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const bookId = req.nextUrl.searchParams.get("bookId") ?? undefined;
  let dbBookId: string | undefined;

  if (bookId) {
    const b = await prisma.book.findFirst({
      where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
    });
    if (b) dbBookId = b.id;
  }

  const whereClause: any = { userId: user.id };
  if (dbBookId) whereClause.bookId = dbBookId;

  const cards = await prisma.flashcard.findMany({
    where: whereClause,
    orderBy: { dueDate: "asc" },
    take: 30,
  });

  return NextResponse.json({ flashcards: cards });
}

/**
 * POST /api/learning/flashcards — generate flashcards or submit spaced repetition rating.
 * Body: { action: "generate"|"review", bookId, page, cardId, rating }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { action, bookId, page, cardId, rating } = await req.json();

    if (action === "generate") {
      if (!bookId) return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
      const flashcards = await generateFlashcardsFromBook(user.id, bookId, page);
      return NextResponse.json({ flashcards });
    }

    if (action === "review") {
      if (!cardId || ![1, 2, 3, 4].includes(rating)) {
        return NextResponse.json({ error: "Invalid cardId or rating (1..4)" }, { status: 400 });
      }
      const updatedCard = await reviewFlashcard(user.id, cardId, rating);
      return NextResponse.json({ flashcard: updatedCard });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Flashcards API Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
