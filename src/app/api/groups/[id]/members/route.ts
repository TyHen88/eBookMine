import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/groups/[id]/members
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;

    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            readingProgresses: {
              orderBy: { lastReadAt: "desc" },
              take: 3,
              include: {
                book: { select: { id: true, title: true, coverUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json({ members });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch members" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups/[id]/members
 * Invite a user by email/ID, or join public group.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json();

    const group = await prisma.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Direct Join (if public group)
    if (body.action === "JOIN") {
      if (group.privacy !== "PUBLIC") {
        return NextResponse.json({ error: "This is a private group. An invite code is required." }, { status: 403 });
      }

      const existing = group.members.find((m) => m.userId === user.id);
      if (existing) {
        return NextResponse.json({ message: "Already a member" });
      }

      const member = await prisma.groupMember.create({
        data: {
          groupId: id,
          userId: user.id,
          role: "MEMBER",
        },
      });

      return NextResponse.json({ message: `Joined ${group.name}!`, member });
    }

    // Invite another user
    const targetQuery = body.userId || body.email;
    if (!targetQuery) {
      return NextResponse.json({ error: "User ID or Email is required" }, { status: 400 });
    }

    const currentMember = group.members.find((m) => m.userId === user.id);
    if (!currentMember) {
      return NextResponse.json({ error: "You must be a group member to invite others" }, { status: 403 });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetQuery },
          { email: { equals: targetQuery, mode: "insensitive" } },
        ],
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const alreadyMember = group.members.find((m) => m.userId === targetUser.id);
    if (alreadyMember) {
      return NextResponse.json({ error: "User is already in this group" }, { status: 400 });
    }

    const newMember = await prisma.groupMember.create({
      data: {
        groupId: id,
        userId: targetUser.id,
        role: "MEMBER",
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json({
      message: `${targetUser.name || targetUser.email} added to group!`,
      member: newMember,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to add member" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/groups/[id]/members
 * Change member role (Owner/Admin only).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const { targetUserId, role } = await req.json();

    if (!targetUserId || !["ADMIN", "MEMBER"].includes(role)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const myMembership = group.members.find((m) => m.userId === user.id);
    if (!myMembership || (myMembership.role !== "OWNER" && myMembership.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden: Admin or Owner required" }, { status: 403 });
    }

    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId: id, userId: targetUserId } },
      data: { role },
    });

    return NextResponse.json({ message: "Role updated successfully", member: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update role" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/[id]/members
 * Remove member from group (kick).
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json({ error: "Target userId required" }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const myMembership = group.members.find((m) => m.userId === user.id);
    if (!myMembership || (myMembership.role !== "OWNER" && myMembership.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden: Admin or Owner required" }, { status: 403 });
    }

    if (group.ownerId === targetUserId) {
      return NextResponse.json({ error: "Cannot remove group owner" }, { status: 400 });
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: id, userId: targetUserId } },
    });

    return NextResponse.json({ message: "Member removed from group" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to remove member" },
      { status: 500 }
    );
  }
}
