import { prisma } from "@/lib/db";

export interface DashboardData {
  continueReading: any[];
  recentlyRead: any[];
  statistics: {
    booksCompleted: number;
    booksReading: number;
    pagesRead: number;
    readingTimeMinutes: number;
    currentStreak: number;
    longestStreak: number;
    weeklyActivity: boolean[];
    avgQuizScore: number;
    flashcardsReviewed: number;
  };
  goals: any[];
  bookmarks: any[];
  notes: any[];
  recommendations: any[];
}

/**
 * Perform single-query efficient server-side aggregation for user dashboard.
 */
export async function getUserDashboardData(userId: string): Promise<DashboardData> {
  const [
    progresses,
    readingGoals,
    bookmarks,
    notes,
    quizAttempts,
    flashcardCount,
    readingLogs,
    allBooks,
  ] = await Promise.all([
    // 1. Reading Progresses with Book relations
    prisma.readingProgress.findMany({
      where: { userId },
      include: {
        book: {
          include: {
            authors: { include: { author: true } },
            categories: { include: { category: true } },
          },
        },
      },
      orderBy: { lastReadAt: "desc" },
    }),

    // 2. Reading Goals
    prisma.readingGoal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),

    // 3. Bookmarks
    prisma.bookmark.findMany({
      where: { userId },
      include: { book: { select: { id: true, title: true, coverUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // 4. Notes
    prisma.note.findMany({
      where: { userId },
      include: { book: { select: { id: true, title: true, coverUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // 5. Quiz Attempts
    prisma.quizAttempt.findMany({
      where: { userId },
      select: { score: true },
    }),

    // 6. Flashcards Reviewed
    prisma.flashcard.count({
      where: { userId, lastReviewedAt: { not: null } },
    }),

    // 7. Reading Logs for Streak calculation
    prisma.readingLog.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 60,
    }),

    // 8. Public Books for recommendations
    prisma.book.findMany({
      where: { published: true },
      include: {
        authors: { include: { author: true } },
        categories: { include: { category: true } },
      },
      take: 10,
    }),
  ]);

  // Aggregate Continue Reading & Recently Read
  const continueReading = progresses
    .filter((p) => p.progressPercentage > 0 && p.progressPercentage < 100)
    .map((p) => ({
      id: p.book.id,
      driveFileId: p.book.driveFileId,
      title: p.book.title,
      coverUrl: p.book.coverUrl,
      author: p.book.authors[0]?.author.name || "Unknown",
      currentPage: p.currentPage,
      totalPages: p.totalPages,
      progressPercentage: p.progressPercentage,
      lastReadAt: p.lastReadAt,
    }));

  const recentlyRead = progresses.slice(0, 6).map((p) => ({
    id: p.book.id,
    driveFileId: p.book.driveFileId,
    title: p.book.title,
    coverUrl: p.book.coverUrl,
    author: p.book.authors[0]?.author.name || "Unknown",
    lastReadAt: p.lastReadAt,
  }));

  // Statistics Calculations
  const booksCompleted = progresses.filter((p) => p.progressPercentage >= 100).length;
  const booksReading = continueReading.length;
  const pagesRead = progresses.reduce((sum, p) => sum + p.currentPage, 0);
  const readingTimeMinutes = Math.round(pagesRead * 2.5); // ~2.5 mins per page

  const avgQuizScore =
    quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((sum, q) => sum + q.score, 0) / quizAttempts.length)
      : 0;

  // Calculate Reading Streak & Weekly Activity Grid
  const logDates = new Set(
    readingLogs.map((l) => new Date(l.date).toISOString().split("T")[0])
  );
  // Also include lastReadAt dates
  progresses.forEach((p) => {
    if (p.lastReadAt) logDates.add(new Date(p.lastReadAt).toISOString().split("T")[0]);
  });

  const todayStr = new Date().toISOString().split("T")[0];
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const checkDate = new Date();
  for (let i = 0; i < 365; i++) {
    const dStr = checkDate.toISOString().split("T")[0];
    if (logDates.has(dStr)) {
      tempStreak++;
      if (i === 0 || currentStreak === i) currentStreak = tempStreak;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      if (i === 0) {
        // If not today, check yesterday for active streak
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        if (!logDates.has(yesterday)) currentStreak = 0;
      }
      tempStreak = 0;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Weekly Activity (Mon - Sun of current week)
  const weeklyActivity: boolean[] = [false, false, false, false, false, false, false];
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0, Sun=6
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - dayOfWeek + i);
    const dStr = d.toISOString().split("T")[0];
    weeklyActivity[i] = logDates.has(dStr);
  }

  // Recommendations: match user's top categories & authors
  const userCategories = new Set(
    progresses.flatMap((p) => p.book.categories.map((c) => c.category.name))
  );
  const userAuthors = new Set(
    progresses.flatMap((p) => p.book.authors.map((a) => a.author.name))
  );

  const readBookIds = new Set(progresses.map((p) => p.book.id));

  const recommendations = allBooks
    .filter((b) => !readBookIds.has(b.id))
    .filter(
      (b) =>
        b.categories.some((c) => userCategories.has(c.category.name)) ||
        b.authors.some((a) => userAuthors.has(a.author.name))
    )
    .slice(0, 4)
    .map((b) => ({
      id: b.id,
      driveFileId: b.driveFileId,
      title: b.title,
      coverUrl: b.coverUrl,
      author: b.authors[0]?.author.name || "Unknown",
      category: b.categories[0]?.category.name || "General",
    }));

  return {
    continueReading,
    recentlyRead,
    statistics: {
      booksCompleted,
      booksReading,
      pagesRead,
      readingTimeMinutes,
      currentStreak: Math.max(currentStreak, logDates.has(todayStr) ? 1 : 0),
      longestStreak: Math.max(longestStreak, currentStreak),
      weeklyActivity,
      avgQuizScore,
      flashcardsReviewed: flashcardCount,
    },
    goals: readingGoals,
    bookmarks,
    notes,
    recommendations,
  };
}
