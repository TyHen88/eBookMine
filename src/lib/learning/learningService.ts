import { prisma } from "@/lib/db";
import { aiProvider } from "@/lib/ai/aiService";
import { retrieveRelevantChunks } from "@/lib/rag/retriever";

export interface SubmitAnswerInput {
  questionId: string;
  userAnswer: string;
}

/**
 * Generate a structured Quiz for a book page/topic using AI.
 */
export async function generateBookQuiz(
  userId: string,
  bookId: string,
  page?: number,
  title?: string
) {
  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
  });

  if (!book) throw new Error("Book not found");

  const chunks = await retrieveRelevantChunks(
    book.title,
    title || (page ? `Page ${page}` : "core concepts"),
    6
  ).catch(() => []);

  const pageChunks = page ? chunks.filter((c) => c.page === page) : [];
  let contextText = (pageChunks.length > 0 ? pageChunks : chunks).map((c) => c.content).join("\n\n");

  if (!contextText.trim() && page) {
    const pageHighlights = await prisma.highlight.findMany({
      where: { bookId: book.id, page },
      take: 6,
    }).catch(() => []);

    if (pageHighlights.length > 0) {
      contextText = pageHighlights.map((h) => h.selectedText).join("\n\n");
    }
  }

  if (!contextText.trim()) {
    contextText = chunks.map((c) => c.content).join("\n\n") || `Book Title: "${book.title}".`;
  }

  const generatedQuestions = await aiProvider.generateQuiz(contextText, 5);

  const quizTitle = title || (page ? `Page ${page} Knowledge Check` : `"${book.title}" Quiz`);

  const questionsData = generatedQuestions.map((q, idx) => ({
    type: "multiple_choice",
    question: q.question,
    options: JSON.stringify(q.options),
    correctAnswer: q.answer,
    explanation: q.explanation || "Correct answer based on book content.",
    page: page || chunks[idx]?.page || 1,
  }));

  const quiz = await prisma.quiz.create({
    data: {
      userId,
      bookId: book.id,
      title: quizTitle,
      page: page || null,
      questions: {
        create: questionsData,
      },
    },
    include: {
      questions: true,
    },
  });

  return quiz;
}

/**
 * Submit a quiz attempt and calculate score.
 */
export async function submitQuizAttempt(
  userId: string,
  quizId: string,
  answers: SubmitAnswerInput[]
) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId },
    include: { questions: true },
  });

  if (!quiz) throw new Error("Quiz not found");

  let correctCount = 0;
  const answerRecords: Array<{ questionId: string; userAnswer: string; isCorrect: boolean }> = [];

  for (const q of quiz.questions) {
    const submitted = answers.find((a) => a.questionId === q.id);
    const userAnswer = submitted?.userAnswer || "";

    const isCorrect =
      userAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase() ||
      q.type === "short_answer";

    if (isCorrect) correctCount++;

    answerRecords.push({
      questionId: q.id,
      userAnswer,
      isCorrect,
    });
  }

  const scorePct = Math.round((correctCount / quiz.questions.length) * 100);

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId,
      userId,
      score: scorePct,
      total: quiz.questions.length,
      answers: {
        create: answerRecords,
      },
    },
    include: {
      answers: true,
    },
  });

  return attempt;
}

/**
 * Generate Flashcards from book content using AI.
 */
export async function generateFlashcardsFromBook(
  userId: string,
  bookId: string,
  page?: number
) {
  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
  });

  if (!book) throw new Error("Book not found");

  const chunks = await retrieveRelevantChunks(
    book.title,
    page ? `Page ${page} key concepts` : "summary",
    5
  ).catch(() => []);

  const contextText = chunks.map((c) => c.content).join("\n\n") || `Book Title: "${book.title}"`;
  const generated = await aiProvider.generateQuiz(contextText, 5).catch(() => []);

  const cardsToCreate = generated.length > 0
    ? generated.map((g) => ({
        userId,
        bookId: book.id,
        page: page || 1,
        question: g.question,
        answer: g.explanation || g.answer,
        difficulty: "medium",
      }))
    : [
        {
          userId,
          bookId: book.id,
          page: page || 1,
          question: `What is the key takeaway on Page ${page || 1}?`,
          answer: `Page ${page || 1} covers foundational principles for "${book.title}".`,
          difficulty: "medium",
        },
      ];

  const createdCards = [];
  for (const cardData of cardsToCreate) {
    const card = await prisma.flashcard.create({ data: cardData });
    createdCards.push(card);
  }

  return createdCards;
}

/**
 * SM-2 Spaced Repetition Review Engine.
 * Ratings: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
 */
export async function reviewFlashcard(
  userId: string,
  cardId: string,
  rating: 1 | 2 | 3 | 4
) {
  const card = await prisma.flashcard.findFirst({
    where: { id: cardId, userId },
  });

  if (!card) throw new Error("Flashcard not found");

  let interval = card.interval;
  let repetition = card.repetition;
  let easeFactor = card.easeFactor;

  if (rating < 3) {
    // Again / Hard reset
    repetition = 0;
    interval = 1;
  } else {
    // Good / Easy progress
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  }

  // Update ease factor: q in [0..5]
  const q = rating + 1; // Map 1..4 to 2..5
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const dueDate = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

  const updated = await prisma.flashcard.update({
    where: { id: cardId },
    data: {
      interval,
      repetition,
      easeFactor,
      dueDate,
      lastReviewedAt: new Date(),
    },
  });

  return updated;
}

/**
 * Aggregate Learning Dashboard Analytics.
 */
export async function getLearningDashboardData(userId: string, bookId?: string) {
  let dbBookId: string | undefined;
  if (bookId) {
    const b = await prisma.book.findFirst({
      where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
    });
    if (b) dbBookId = b.id;
  }

  const whereClause: any = { userId };
  if (dbBookId) whereClause.bookId = dbBookId;

  // Quiz Attempts & Average Score
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId },
    select: { score: true, total: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const avgQuizScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length)
      : 0;

  // Flashcards Due & Reviewed
  const now = new Date();
  const dueFlashcards = await prisma.flashcard.findMany({
    where: {
      ...whereClause,
      dueDate: { lte: now },
    },
    take: 20,
  });

  const totalReviewed = await prisma.flashcard.count({
    where: {
      ...whereClause,
      lastReviewedAt: { not: null },
    },
  });

  const totalCards = await prisma.flashcard.count({
    where: whereClause,
  });

  return {
    avgQuizScore,
    totalAttempts: attempts.length,
    recentAttempts: attempts,
    dueCount: dueFlashcards.length,
    dueFlashcards,
    totalReviewed,
    totalCards,
  };
}
