import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function generateInviteCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-character hex code, e.g. "A3F8E1"
}

/**
 * GET /api/groups
 * Return user's groups and discoverable public groups.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "all";

    // 1. Groups where user is a member
    const myMemberships = await prisma.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            owner: { select: { id: true, name: true, image: true, email: true } },
            members: {
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
            },
            folders: { select: { id: true, name: true, color: true } },
            books: {
              include: {
                book: { select: { id: true, title: true, coverUrl: true } },
              },
            },
            _count: {
              select: {
                members: true,
                books: true,
                folders: true,
                discussions: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const myGroups = myMemberships.map((m) => ({
      ...m.group,
      myRole: m.role,
      joinedAt: m.joinedAt,
    }));

    // 2. Discoverable public groups (excluding ones user is already in)
    const myGroupIds = myGroups.map((g) => g.id);
    const publicGroups = await prisma.group.findMany({
      where: {
        privacy: "PUBLIC",
        id: { notIn: myGroupIds.length > 0 ? myGroupIds : ["none"] },
      },
      include: {
        owner: { select: { id: true, name: true, image: true } },
        _count: {
          select: {
            members: true,
            books: true,
            discussions: true,
          },
        },
      },
      take: 12,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      myGroups,
      publicGroups,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load groups" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups
 * Create new group OR Join group with invite code.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const body = await req.json();

    // 1. Join with code action
    if (body.action === "JOIN_WITH_CODE") {
      const code = body.code?.trim().toUpperCase();
      if (!code) {
        return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
      }

      const group = await prisma.group.findUnique({
        where: { code },
      });

      if (!group) {
        return NextResponse.json({ error: "Invalid group invite code" }, { status: 404 });
      }

      // Check if already a member
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: { groupId: group.id, userId: user.id },
        },
      });

      if (existingMember) {
        return NextResponse.json({ message: "You are already in this group", groupId: group.id });
      }

      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: user.id,
          role: "MEMBER",
        },
      });

      return NextResponse.json({
        message: `Successfully joined ${group.name}!`,
        groupId: group.id,
      });
    }

    // 2. Create new group
    const { name, description, privacy = "PUBLIC", avatar, banner } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    // Generate unique code
    let code = generateInviteCode();
    let codeExists = await prisma.group.findUnique({ where: { code } });
    while (codeExists) {
      code = generateInviteCode();
      codeExists = await prisma.group.findUnique({ where: { code } });
    }

    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        privacy: ["PUBLIC", "PRIVATE", "SECRET"].includes(privacy) ? privacy : "PUBLIC",
        avatar: avatar || null,
        banner: banner || null,
        code,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
        folders: {
          create: [
            {
              name: "General Reading",
              description: "Main shared book collection",
              color: "blue",
            },
          ],
        },
      },
      include: {
        members: true,
        folders: true,
      },
    });

    return NextResponse.json({
      message: "Group created successfully!",
      group,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create group" },
      { status: 500 }
    );
  }
}
