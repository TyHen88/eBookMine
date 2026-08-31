import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/friends
 * Returns accepted friends, pending incoming requests, and pending outgoing requests.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const [sent, received] = await Promise.all([
      prisma.friendship.findMany({
        where: { senderId: user.id },
        include: {
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              readingProgresses: {
                orderBy: { lastReadAt: "desc" },
                take: 1,
                include: {
                  book: {
                    select: {
                      id: true,
                      title: true,
                      coverUrl: true,
                      pageCount: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.friendship.findMany({
        where: { receiverId: user.id },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              readingProgresses: {
                orderBy: { lastReadAt: "desc" },
                take: 1,
                include: {
                  book: {
                    select: {
                      id: true,
                      title: true,
                      coverUrl: true,
                      pageCount: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const acceptedFriends = [
      ...sent
        .filter((f) => f.status === "ACCEPTED")
        .map((f) => ({
          friendshipId: f.id,
          friend: f.receiver,
          since: f.updatedAt,
        })),
      ...received
        .filter((f) => f.status === "ACCEPTED")
        .map((f) => ({
          friendshipId: f.id,
          friend: f.sender,
          since: f.updatedAt,
        })),
    ];

    const pendingIncoming = received
      .filter((f) => f.status === "PENDING")
      .map((f) => ({
        friendshipId: f.id,
        sender: f.sender,
        createdAt: f.createdAt,
      }));

    const pendingOutgoing = sent
      .filter((f) => f.status === "PENDING")
      .map((f) => ({
        friendshipId: f.id,
        receiver: f.receiver,
        createdAt: f.createdAt,
      }));

    return NextResponse.json({
      friends: acceptedFriends,
      pendingIncoming,
      pendingOutgoing,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch friends" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/friends
 * Send a friend request by user email or ID.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Email or User search query is required" }, { status: 400 });
    }

    const cleanQuery = query.trim().toLowerCase();

    // Look for target user by exact email or case-insensitive search
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanQuery, mode: "insensitive" } },
          { name: { equals: cleanQuery, mode: "insensitive" } },
          { id: cleanQuery },
        ],
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found with this email or name" }, { status: 404 });
    }

    if (targetUser.id === user.id) {
      return NextResponse.json({ error: "You cannot add yourself as a friend" }, { status: 400 });
    }

    // Check existing friendship
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: user.id, receiverId: targetUser.id },
          { senderId: targetUser.id, receiverId: user.id },
        ],
      },
    });

    if (existing) {
      if (existing.status === "ACCEPTED") {
        return NextResponse.json({ error: "You are already friends" }, { status: 400 });
      }
      if (existing.status === "PENDING") {
        if (existing.senderId === user.id) {
          return NextResponse.json({ error: "Friend request already sent" }, { status: 400 });
        } else {
          // Auto-accept if they already requested us
          const updated = await prisma.friendship.update({
            where: { id: existing.id },
            data: { status: "ACCEPTED" },
          });
          return NextResponse.json({ message: "Friend request accepted!", friendship: updated });
        }
      }
    }

    const friendship = await prisma.friendship.create({
      data: {
        senderId: user.id,
        receiverId: targetUser.id,
        status: "PENDING",
      },
      include: {
        receiver: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ message: "Friend request sent!", friendship });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to send friend request" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/friends
 * Accept or decline a pending request.
 */
export async function PATCH(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { friendshipId, action } = await req.json();

    if (!friendshipId || !["ACCEPT", "DECLINE"].includes(action)) {
      return NextResponse.json({ error: "Invalid friendshipId or action" }, { status: 400 });
    }

    const request = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!request) {
      return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
    }

    if (request.receiverId !== user.id && request.senderId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (action === "ACCEPT") {
      const updated = await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: "ACCEPTED" },
      });
      return NextResponse.json({ message: "Friend request accepted!", friendship: updated });
    } else {
      await prisma.friendship.delete({
        where: { id: friendshipId },
      });
      return NextResponse.json({ message: "Friend request declined" });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update friend request" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/friends
 * Remove a friend.
 */
export async function DELETE(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const friendshipId = searchParams.get("id");

    if (!friendshipId) {
      return NextResponse.json({ error: "Friendship ID required" }, { status: 400 });
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
    }

    if (friendship.senderId !== user.id && friendship.receiverId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return NextResponse.json({ message: "Friend removed successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to remove friend" },
      { status: 500 }
    );
  }
}
