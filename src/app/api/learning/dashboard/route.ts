import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { getLearningDashboardData } from "@/lib/learning/learningService";

export const dynamic = "force-dynamic";

/**
 * GET /api/learning/dashboard?bookId=... — fetch user learning dashboard analytics.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const bookId = req.nextUrl.searchParams.get("bookId") ?? undefined;
  const dashboard = await getLearningDashboardData(user.id, bookId);

  return NextResponse.json(dashboard);
}
