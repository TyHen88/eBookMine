import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users — list registered users.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          readingProgresses: true,
          bookmarks: true,
          notes: true,
          quizzes: true,
          flashcards: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

/**
 * PATCH /api/admin/users — change user role (USER / ADMIN).
 * Body: { userId: string, role: "USER" | "ADMIN" }
 */
export async function PATCH(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { userId, role } = await req.json();
    if (!userId || !["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Invalid userId or role" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Role Update Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
