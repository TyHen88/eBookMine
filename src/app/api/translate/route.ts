import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/translateService";

export const dynamic = "force-dynamic";

/**
 * POST /api/translate
 * Body: { text: string, to?: string, from?: string }
 */
export async function POST(req: NextRequest) {

  try {
    const { text, to = "en", from = "auto" } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text string is required" }, { status: 400 });
    }

    const res = await translateText(text, to, from);

    return NextResponse.json({
      translatedText: res.translatedText,
      detectedSourceLang: res.detectedSourceLang,
      detectedSourceLangName: res.detectedSourceLangName,
      definitions: res.definitions,
      provider: "google-translate",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Translation failed" },
      { status: 500 }
    );
  }
}

