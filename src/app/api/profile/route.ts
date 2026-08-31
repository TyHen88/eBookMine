import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";
import { getMergedBooks } from "@/lib/booksService";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile
 * Returns user profile, stats, favorite books, and reading summary.
 */
export async function GET(req: NextRequest) {
  const { user, session, response } = await requireUser();
  if (response) return response;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch user groups count
    const groupsCount = await prisma.groupMember.count({
      where: { userId: user.id },
    });

    // Fetch user reading progresses
    const progresses = await prisma.readingProgress.findMany({
      where: { userId: user.id },
      include: {
        book: {
          select: {
            id: true,
            driveFileId: true,
            title: true,
            coverUrl: true,
            pageCount: true,
            authors: { include: { author: true } },
          },
        },
      },
      orderBy: { lastReadAt: "desc" },
    });

    // Fetch notes & bookmarks counts
    const notesCount = await prisma.note.count({
      where: { userId: user.id },
    });

    const bookmarksCount = await prisma.bookmark.count({
      where: { userId: user.id },
    });

    // Fetch all user books to filter favorites
    const token = session.accessToken ?? "";
    const allBooks = await getMergedBooks(token, { userId: user.id });
    const favoriteBooks = allBooks.filter((b) => b.favorite);

    const completedBooksCount = progresses.filter((p) => {
      const pageCount = p.book?.pageCount || 0;
      return pageCount > 0 && p.currentPage >= pageCount;
    }).length;

    return NextResponse.json({
      user: dbUser,
      stats: {
        favoritesCount: favoriteBooks.length,
        inProgressCount: progresses.length - completedBooksCount,
        completedCount: completedBooksCount,
        groupsCount,
        notesCount,
        bookmarksCount,
      },
      favoriteBooks,
      recentProgresses: progresses.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load profile" },
      { status: 500 }
    );
  }
}
