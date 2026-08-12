import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { getContinueReading } from "@/lib/readingService";

export const dynamic = "force-dynamic";

/**
 * GET /api/reading/continue — fetch active Continue Reading items for authenticated user.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const items = await getContinueReading(user.id, 6);
    return NextResponse.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
