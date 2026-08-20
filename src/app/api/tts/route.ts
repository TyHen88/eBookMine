import { NextRequest, NextResponse } from "next/server";
import { containsKhmer, sanitizeKhmerOutput } from "@/lib/khmerHelper";

export const dynamic = "force-dynamic";

/**
 * Splits text into small chunks (< 100 chars) along natural punctuation/space boundaries
 * so Google Translate TTS endpoint won't reject long text queries.
 */
function splitTextForTTS(text: string, maxLen = 95): string[] {
  const clean = text.trim();
  if (clean.length <= maxLen) return [clean];

  // Regex to split on Khmer punctuation (។ ៕ ៖), standard punctuation (. ! ?), newlines
  const sentences = clean.split(/([\u17D4\u17D5\u17D6\n\r.!?]+)/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (let i = 0; i < sentences.length; i++) {
    const part = sentences[i];
    if ((current + part).length <= maxLen) {
      current += part;
    } else {
      if (current.trim()) chunks.push(current.trim());

      if (part.length <= maxLen) {
        current = part;
      } else {
        // If an individual part is still too long, split by spaces / words
        const subParts = part.split(/([, \s]+)/).filter(Boolean);
        current = "";
        for (const sub of subParts) {
          if ((current + sub).length <= maxLen) {
            current += sub;
          } else {
            if (current.trim()) chunks.push(current.trim());
            current = sub;
          }
        }
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Detect language code from text or explicit request param.
 */
function resolveTtsLanguage(text: string, requestedLang?: string | null): string {
  if (requestedLang && requestedLang.toLowerCase() !== "auto") {
    return requestedLang;
  }

  // 1. Khmer script
  if (containsKhmer(text)) {
    return "km";
  }

  // 2. Chinese (Han)
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return "zh-CN";
  }

  // 3. Japanese (Hiragana / Katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return "ja";
  }

  // 4. Korean (Hangul)
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) {
    return "ko";
  }

  // 5. Arabic
  if (/[\u0600-\u06FF]/.test(text)) {
    return "ar";
  }

  // 6. Russian / Cyrillic
  if (/[\u0400-\u04FF]/.test(text)) {
    return "ru";
  }

  // Default to English for English/Latin text
  return "en";
}

/**
 * GET /api/tts?text=...&lang=...
 * Streams high-fidelity Text-To-Speech audio with multi-chunk concatenation for long texts.
 */
export async function GET(req: NextRequest) {
  try {
    const text = req.nextUrl.searchParams.get("text");
    const reqLang = req.nextUrl.searchParams.get("lang");

    if (!text || !text.trim()) {
      return new NextResponse("Text parameter is required", { status: 400 });
    }

    const lang = resolveTtsLanguage(text, reqLang);
    const cleanText = lang === "km" ? sanitizeKhmerOutput(text.trim()) : text.trim();
    const chunks = splitTextForTTS(cleanText, 95);

    // Limit maximum chunks to 20 (~2000 chars) for responsive streaming
    const limitedChunks = chunks.slice(0, 20);

    const fetchChunkAudio = async (chunk: string): Promise<Buffer | null> => {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
        lang
      )}&q=${encodeURIComponent(chunk)}`;

      try {
        const res = await fetch(ttsUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Referer: "https://translate.google.com/",
          },
        });

        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      } catch {
        return null;
      }
    };

    const audioBuffers: Buffer[] = [];
    for (const chunk of limitedChunks) {
      const buf = await fetchChunkAudio(chunk);
      if (buf && buf.length > 0) {
        audioBuffers.push(buf);
      }
    }

    if (audioBuffers.length === 0) {
      return new NextResponse("TTS upstream service error", { status: 502 });
    }

    const concatenatedBuffer = Buffer.concat(audioBuffers);

    return new NextResponse(concatenatedBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(concatenatedBuffer.length),
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "TTS error";
    return new NextResponse(msg, { status: 500 });
  }
}
