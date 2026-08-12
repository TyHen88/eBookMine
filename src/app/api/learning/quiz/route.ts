import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { generateBookQuiz, submitQuizAttempt } from "@/lib/learning/learningService";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/learning/quiz?bookId=... — fetch quizzes for authenticated user and book.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "Missing bookId" }, { status: 400 });

  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
  });

  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const quizzes = await prisma.quiz.findMany({
    where: { userId: user.id, bookId: book.id },
    include: {
      questions: true,
      attempts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ quizzes });
}

/**
 * POST /api/learning/quiz — generate a new Quiz or submit a Quiz Attempt.
 * Body: { action: "generate"|"submit", bookId, page, title, quizId, answers }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { action, bookId, page, title, quizId, answers } = await req.json();

    if (action === "generate") {
      if (!bookId) return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
      const quiz = await generateBookQuiz(user.id, bookId, page, title);
      return NextResponse.json({ quiz });
    }

    if (action === "submit") {
      if (!quizId || !Array.isArray(answers)) {
        return NextResponse.json({ error: "Missing quizId or answers" }, { status: 400 });
      }
      const attempt = await submitQuizAttempt(user.id, quizId, answers);
      return NextResponse.json({ attempt });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Quiz API Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
