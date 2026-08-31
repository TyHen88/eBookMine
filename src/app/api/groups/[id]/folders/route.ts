import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/groups/[id]/folders
 * List folders with books in this group.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;

    const folders = await prisma.groupFolder.findMany({
      where: { groupId: id },
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
            addedBy: { select: { id: true, name: true, image: true } },
          },
          orderBy: { addedAt: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ folders });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch group folders" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups/[id]/folders
 * Create a new folder or add a book to the group.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const action = body.action || "CREATE_FOLDER";

    // Verify user is member of this group
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "You must be a member of this group" }, { status: 403 });
    }

    // 1. Create a new folder
    if (action === "CREATE_FOLDER") {
      if (membership.role === "MEMBER") {
        return NextResponse.json({ error: "Only group administrators and owners can create folders" }, { status: 403 });
      }

      const { name, description, color = "blue", icon = "folder" } = body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
      }

      const folder = await prisma.groupFolder.create({
        data: {
          groupId: id,
          name: name.trim(),
          description: description?.trim() || null,
          color,
          icon,
        },
        include: {
          books: true,
        },
      });

      return NextResponse.json({ message: "Folder created successfully", folder });
    }

    // 2. Add Book to group / folder
    if (action === "ADD_BOOK") {
      if (membership.role === "MEMBER") {
        return NextResponse.json({ error: "Only group administrators and owners can add books to the group" }, { status: 403 });
      }

      const { bookId, groupFolderId } = body;
      if (!bookId) {
        return NextResponse.json({ error: "Book ID is required" }, { status: 400 });
      }

      // Lookup book by Postgres ID or Drive File ID
      const book = await prisma.book.findFirst({
        where: {
          OR: [{ id: bookId }, { driveFileId: bookId }],
        },
      });

      if (!book) {
        return NextResponse.json({ error: "Book not found" }, { status: 404 });
      }

      // Check if already in this group
      const existing = await prisma.groupBook.findUnique({
        where: { groupId_bookId: { groupId: id, bookId: book.id } },
      });

      if (existing) {
        // If moving to another folder
        if (groupFolderId && existing.groupFolderId !== groupFolderId) {
          const updated = await prisma.groupBook.update({
            where: { id: existing.id },
            data: { groupFolderId },
          });
          return NextResponse.json({ message: "Book moved to folder", groupBook: updated });
        }
        return NextResponse.json({ message: "Book is already in this group", groupBook: existing });
      }

      const groupBook = await prisma.groupBook.create({
        data: {
          groupId: id,
          groupFolderId: groupFolderId || null,
          bookId: book.id,
          addedById: user.id,
        },
        include: {
          book: {
            select: {
              id: true,
              driveFileId: true,
              title: true,
              coverUrl: true,
              pageCount: true,
            },
          },
          addedBy: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ message: "Book added to group library!", groupBook });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to process folder request" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/[id]/folders
 * Delete a group folder or remove a book from group.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");
    const bookId = searchParams.get("bookId");

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Remove book from group (Admin/Owner only)
    if (bookId) {
      if (membership.role === "MEMBER") {
        return NextResponse.json({ error: "Only group administrators and owners can remove books" }, { status: 403 });
      }

      const book = await prisma.book.findFirst({
        where: {
          OR: [{ id: bookId }, { driveFileId: bookId }],
        },
      });

      const actualBookId = book ? book.id : bookId;

      const groupBook = await prisma.groupBook.findFirst({
        where: {
          groupId: id,
          OR: [{ bookId: actualBookId }, { bookId }],
        },
      });

      if (!groupBook) {
        return NextResponse.json({ error: "Book not found in group" }, { status: 404 });
      }

      await prisma.groupBook.delete({
        where: { id: groupBook.id },
      });

      return NextResponse.json({ message: "Book removed from group" });
    }

    // Delete folder (Only Admin/Owner)
    if (folderId) {
      if (membership.role === "MEMBER") {
        return NextResponse.json({ error: "Only group administrators and owners can delete folders" }, { status: 403 });
      }

      await prisma.groupFolder.delete({
        where: { id: folderId },
      });

      return NextResponse.json({ message: "Folder deleted successfully" });
    }

    return NextResponse.json({ error: "Specify folderId or bookId to delete" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete item" },
      { status: 500 }
    );
  }
}
