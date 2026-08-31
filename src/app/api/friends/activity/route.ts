import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/friends/activity
 * Fetch recent reading logs and active book progress for all accepted friends.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    });

    const friendIds = friendships.map((f) =>
      f.senderId === user.id ? f.receiverId : f.senderId
    );

    if (friendIds.length === 0) {
      return NextResponse.json({ activities: [] });
    }

    // Retrieve active reading progress and notes for friends
    const [progressList, recentNotes] = await Promise.all([
      prisma.readingProgress.findMany({
        where: {
          userId: { in: friendIds },
        },
        orderBy: { lastReadAt: "desc" },
        take: 20,
        include: {
          user: {
            select: { id: true, name: true, image: true, email: true },
          },
          book: {
            select: { id: true, title: true, coverUrl: true, pageCount: true },
          },
        },
      }),
      prisma.note.findMany({
        where: {
          userId: { in: friendIds },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: {
            select: { id: true, name: true, image: true, email: true },
          },
          book: {
            select: { id: true, title: true, coverUrl: true },
          },
        },
      }),
    ]);

    const activities = [
      ...progressList.map((p) => ({
        id: `prog-${p.id}`,
        type: p.progressPercentage >= 100 ? "COMPLETED_BOOK" : "READING",
        user: p.user,
        book: p.book,
        currentPage: p.currentPage,
        totalPages: p.totalPages || p.book.pageCount,
        progressPercentage: Math.round(p.progressPercentage),
        timestamp: p.lastReadAt,
      })),
      ...recentNotes.map((n) => ({
        id: `note-${n.id}`,
        type: "NOTE_ADDED",
        user: n.user,
        book: n.book,
        page: n.page,
        content: n.content.slice(0, 120),
        timestamp: n.createdAt,
      })),
    ].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ activities });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch friends activity" },
      { status: 500 }
    );
  }
}
