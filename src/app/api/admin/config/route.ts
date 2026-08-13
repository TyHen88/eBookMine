import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { getAIConfig, saveAIConfig } from "@/lib/aiConfig";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/config — Fetch current AI configuration settings.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const config = await getAIConfig();
    return NextResponse.json({ config });
  } catch (err) {
    logger.error("GET /api/admin/config failed", err);
    return NextResponse.json({ error: "Failed to fetch AI config" }, { status: 500 });
  }
}

/**
 * POST /api/admin/config — Save dynamic AI configuration settings without manual .env changes.
 * Body: { provider, model, apiKey, systemPrompt, chunkSize, chunkOverlap, dailyTokenLimit, temperature }
 */
export async function POST(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const body = await req.json();
    const updated = await saveAIConfig(body);
    return NextResponse.json({ success: true, config: updated });
  } catch (err) {
    logger.error("POST /api/admin/config failed", err);
    return NextResponse.json({ error: "Failed to save AI config" }, { status: 500 });
  }
}
