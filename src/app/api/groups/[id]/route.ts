import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/groups/[id]
 * Fetch detailed group workspace data.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, image: true, email: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
                readingProgresses: {
                  orderBy: { lastReadAt: "desc" },
                  take: 1,
                  include: {
                    book: { select: { id: true, title: true } },
                  },
                },
              },
            },
          },
          orderBy: { role: "asc" },
        },
        folders: {
          include: {
            books: {
              include: {
                book: {
                  select: {
                    id: true,
                    driveFileId: true,
                    title: true,
                    coverUrl: true,
                    pageCount: true,
                    language: true,
                    authors: { include: { author: true } },
                  },
                },
                addedBy: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        books: {
          include: {
            book: {
              select: {
                id: true,
                driveFileId: true,
                title: true,
                coverUrl: true,
                pageCount: true,
                language: true,
                authors: { include: { author: true } },
              },
            },
            addedBy: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            discussions: true,
            members: true,
            books: true,
            folders: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const membership = group.members.find((m) => m.userId === user.id);

    // If group is SECRET/PRIVATE and user is not a member, forbid
    if (group.privacy !== "PUBLIC" && !membership) {
      return NextResponse.json({ error: "You are not a member of this private group" }, { status: 403 });
    }

    return NextResponse.json({
      group,
      myRole: membership?.role || null,
      isMember: !!membership,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch group" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/groups/[id]
 * Update group metadata (Owner/Admin only).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json();

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      return NextResponse.json({ error: "Only group Admins or Owner can edit group settings" }, { status: 403 });
    }

    const { name, description, privacy, avatar, banner } = body;

    const updated = await prisma.group.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(privacy && ["PUBLIC", "PRIVATE", "SECRET"].includes(privacy) ? { privacy } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
        ...(banner !== undefined ? { banner } : {}),
      },
    });

    return NextResponse.json({ message: "Group updated successfully", group: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update group" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/[id]
 * Delete group (Owner only) or Leave group (Members).
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action"); // "leave" or "delete"

    const group = await prisma.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (action === "leave") {
      if (group.ownerId === user.id) {
        return NextResponse.json({ error: "Group owner cannot leave. Delete the group or transfer ownership." }, { status: 400 });
      }

      await prisma.groupMember.delete({
        where: { groupId_userId: { groupId: id, userId: user.id } },
      });

      return NextResponse.json({ message: "You have left the group" });
    }

    // Default: Delete group (Owner only)
    if (group.ownerId !== user.id) {
      return NextResponse.json({ error: "Only the group owner can delete the group" }, { status: 403 });
    }

    await prisma.group.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Group deleted successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
