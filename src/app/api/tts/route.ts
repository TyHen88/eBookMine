import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/tts?text=...&lang=...
 * Streams high-fidelity Text-To-Speech audio (especially for languages like Khmer (km) 
 * which are not supported by default OS browser speech synthesis).
 */
export async function GET(req: NextRequest) {
  try {
    const text = req.nextUrl.searchParams.get("text");
    const lang = req.nextUrl.searchParams.get("lang") || "km";

    if (!text || !text.trim()) {
      return new NextResponse("Text parameter is required", { status: 400 });
    }

    // Limit chunk to avoid URL length constraints for single speech playback
    const cleanText = text.trim().slice(0, 300);
    const targetLang = lang === "auto" ? "km" : lang;

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
      targetLang
    )}&q=${encodeURIComponent(cleanText)}`;

    const res = await fetch(ttsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });

    if (!res.ok) {
      return new NextResponse("TTS upstream service error", { status: res.status });
    }

    const audioBuffer = await res.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "TTS error";
    return new NextResponse(msg, { status: 500 });
  }
}
