import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { saveProgress, getProgress } from "@/lib/readingService";

export const dynamic = "force-dynamic";

/**
 * GET /api/reading/progress?bookId=... — retrieve saved reading position.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  if (!bookId) {
    return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
  }

  const progress = await getProgress(user.id, bookId);
  return NextResponse.json({ progress });
}

/**
 * POST /api/reading/progress — save reading position (currentPage, totalPages).
 * Body: { bookId: string, currentPage: number, totalPages: number }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const { bookId, currentPage, totalPages } = body;
    if (!bookId || typeof currentPage !== "number") {
      return NextResponse.json({ error: "Invalid progress payload" }, { status: 400 });
    }

    const progress = await saveProgress(
      user.id,
      bookId,
      Math.max(1, currentPage),
      Math.max(0, totalPages || 0)
    );

    return NextResponse.json({ progress: progress || { currentPage, totalPages, progressPercentage: 0 } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg, fallback: true }, { status: 200 });
  }
}
