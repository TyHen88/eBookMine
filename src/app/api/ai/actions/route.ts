import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { aiProvider, checkAndTrackUsage } from "@/lib/ai/aiService";
import { BookContext } from "@/lib/ai/aiProvider";
import { translateText } from "@/lib/translateService";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/actions — execute quick AI actions (explain, simplify, translate, quiz, flashcards).
 * Body: { action: "explain"|"simplify"|"translate"|"quiz"|"flashcards", text, page, bookTitle, author, targetLang }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { action, text, page, bookTitle, author, targetLang, targetLangName } = await req.json();
    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (action !== "translate") {
      await checkAndTrackUsage(user.id, action, 200);
    }

    const context: BookContext = {
      bookTitle,
      author,
      page,
      selectedText: text,
    };

    switch (action) {
      case "explain": {
        const langNames: Record<string, string> = {
          km: "Khmer",
          en: "English",
          es: "Spanish",
          fr: "French",
          de: "German",
          ja: "Japanese",
          "zh-CN": "Chinese",
          vi: "Vietnamese",
          ko: "Korean",
        };
        const targetName = (targetLangName && typeof targetLangName === "string" ? targetLangName : langNames[targetLang || "km"]) || "Khmer";
        const isTargetKhmer = targetLang === "km" || targetName.toLowerCase().includes("khmer");

        const khmerGuideline = isTargetKhmer
          ? `\n\nSTRICT KHMER SCRIPT & LANGUAGE RULES (ភាសាខ្មែរ):
- The ${targetName} explanation must be written in 100% pure standard Khmer (អក្សរខ្មែរ / Unicode U+1780-U+17FF).
- ZERO THAI SCRIPT: Absolutely NEVER output Thai script (ภาษาไทย / U+0E00-U+0E7F) or Thai words/particles.
- Format with authentic Khmer headings (e.g. ### 📖 អត្ថន័យ និងការពន្យល់, **ឧទាហរណ៍ជាក់ស្ដែង**).`
          : "";

        const prompt = `Provide a clear, dual-language AI explanation of the following word, phrase, or text in BOTH English AND ${targetName}:

TEXT: "${text}"

REQUIREMENTS FOR EACH LANGUAGE:
1. Core Meaning & Definition
2. Real-World Example Sentences${khmerGuideline}

CRITICAL FORMAT REQUIREMENT: Output the English explanation first, followed by the separator line "===SPLIT_LANG_EXPLANATION===", followed by the complete ${targetName} explanation.`;

        const result = await aiProvider.generateText(prompt, context);
        return NextResponse.json({ result });
      }

      case "simplify": {
        const hasKhmer = /[\u1780-\u17FF]/.test(text);
        const khmerNote = hasKhmer
          ? "\n\nNOTE: The input contains Khmer. Respond purely in natural standard Khmer (ភាសាខ្មែរ) without any Thai script (ภาษาไทย)."
          : "";

        const prompt = `Rephrase and simplify the following passage into plain, easy-to-understand language while preserving its exact core meaning:

"${text}"

SIMPLIFY REQUIREMENTS:
- **Plain Summary**: 2 sentences explaining the main idea in simple, everyday language.
- **Key Takeaways**: 3 concise bullet points listing the primary facts or steps.
- **Length**: Compact and clear (100–180 words). Eliminate unnecessary jargon and fluff.${khmerNote}`;

        const result = await aiProvider.generateText(prompt, context);
        return NextResponse.json({ result });
      }
      case "translate": {
        const lang = targetLang || "km";
        const gtResult = await translateText(text, lang);
        return NextResponse.json({
          result: gtResult.translatedText,
          provider: "google-translate",
        });
      }
      case "quiz": {
        const questions = await aiProvider.generateQuiz(text || "Page content", 3);
        return NextResponse.json({ questions });
      }
      case "flashcards": {
        const flashcards = await aiProvider.generateFlashcards(text || "Page content");
        return NextResponse.json({ flashcards });
      }
      default:
        return NextResponse.json({ error: "Unknown AI action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI Action Error";
    const status = msg.includes("limit") || msg.includes("rate") ? 429 : 500;
    logger.error("POST /api/ai/actions failed", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
