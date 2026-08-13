import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/translateService";
import { requireUser } from "@/lib/authHelpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/translate
 * Body: { text: string, to?: string }
 */
export async function POST(req: NextRequest) {
  const { response } = await requireUser();
  if (response) return response;

  try {
    const { text, to = "en" } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text string is required" }, { status: 400 });
    }

    const res = await translateText(text, to);

    return NextResponse.json({
      translatedText: res.translatedText,
      provider: "google-translate",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Translation failed" },
      { status: 500 }
    );
  }
}
