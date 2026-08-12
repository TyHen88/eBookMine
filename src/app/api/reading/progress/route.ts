import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { saveProgress } from "@/lib/readingService";

export const dynamic = "force-dynamic";

/**
 * POST /api/reading/progress — save reading position (currentPage, totalPages).
 * Body: { bookId: string, currentPage: number, totalPages: number }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { bookId, currentPage, totalPages } = await req.json();
    if (!bookId || typeof currentPage !== "number") {
      return NextResponse.json({ error: "Invalid progress payload" }, { status: 400 });
    }

    const progress = await saveProgress(
      user.id,
      bookId,
      Math.max(1, currentPage),
      Math.max(0, totalPages || 0)
    );

    return NextResponse.json({ progress });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
