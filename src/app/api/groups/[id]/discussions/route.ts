import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/groups/[id]/discussions
 * Fetch discussion threads and book comments.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");

    const discussions = await prisma.groupDiscussion.findMany({
      where: {
        groupId: id,
        ...(bookId ? { bookId } : {}),
      },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
        book: { select: { id: true, title: true, coverUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ discussions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch discussions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups/[id]/discussions
 * Post a new message or book excerpt discussion.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const { content, bookId, page, selectedText } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Must be a member to post in discussions" }, { status: 403 });
    }

    const discussion = await prisma.groupDiscussion.create({
      data: {
        groupId: id,
        userId: user.id,
        content: content.trim(),
        bookId: bookId || null,
        page: page ? Number(page) : null,
        selectedText: selectedText || null,
      },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
        book: { select: { id: true, title: true, coverUrl: true } },
      },
    });

    return NextResponse.json({ message: "Message posted!", discussion });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to post message" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/[id]/discussions
 * Delete message.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const discussionId = searchParams.get("discussionId");

    if (!discussionId) {
      return NextResponse.json({ error: "Discussion ID required" }, { status: 400 });
    }

    const discussion = await prisma.groupDiscussion.findUnique({
      where: { id: discussionId },
    });

    if (!discussion) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (discussion.userId !== user.id && membership.role === "MEMBER") {
      return NextResponse.json({ error: "Forbidden: You can only delete your own messages" }, { status: 403 });
    }

    await prisma.groupDiscussion.delete({
      where: { id: discussionId },
    });

    return NextResponse.json({ message: "Message deleted" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete discussion" },
      { status: 500 }
    );
  }
}
