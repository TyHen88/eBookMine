import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { getUserDashboardData } from "@/lib/dashboardService";
import { prisma } from "@/lib/db";
import { goalSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard — fetch user's aggregated dashboard payload.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const data = await getUserDashboardData(user.id);
    return NextResponse.json(data);
  } catch (err) {
    logger.error("GET /api/dashboard failed", err);
    return NextResponse.json({ error: "Dashboard Error" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard — create or update a Reading Goal.
 * Body: { type: "daily_minutes" | "daily_pages" | "weekly_pages" | "monthly_books" | "yearly_books", target: number, period: string }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const body = await req.json();

    // Validate with Zod
    const validation = goalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid goal data", details: validation.error.issues.map(i => i.message) },
        { status: 400 }
      );
    }

    const { type, target, period } = validation.data;

    const goal = await prisma.readingGoal.create({
      data: {
        userId: user.id,
        type,
        target,
        period: period || "daily",
        startDate: new Date(),
      },
    });

    logger.info("Reading goal created", { userId: user.id, type, target });
    return NextResponse.json({ goal });
  } catch (err) {
    logger.error("POST /api/dashboard goal creation failed", err);
    return NextResponse.json({ error: "Goal Creation Error" }, { status: 400 });
  }
}
