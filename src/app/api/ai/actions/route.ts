import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";
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
  try {
    const session = await getSession();
    const user = session?.user?.email
      ? await prisma.user.findUnique({ where: { email: session.user.email } })
      : null;

    const { action, text, page, bookTitle, author, targetLang, targetLangName } = await req.json();
    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (user && action !== "translate") {
      try {
        await checkAndTrackUsage(user.id, action, 200);
      } catch (usageErr: any) {
        return NextResponse.json(
          { error: usageErr.message || "Daily AI limit reached" },
          { status: 429 }
        );
      }
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
- ZERO THAI SCRIPT: Absolutely NEVER output any Thai Unicode characters (U+0E00-U+0E7F) or non-Khmer script.
- Format with authentic Khmer headings (e.g. ### 📖 អត្ថន័យ និងការពន្យល់, **ឧទាហរណ៍ជាក់ស្ដែង**).`
          : "";

        const bookContextText = bookTitle
          ? `(from the book "${bookTitle}"${author ? ` by ${author}` : ""}${page ? `, Page ${page}` : ""})`
          : "";

        const prompt = `You are analyzing the following excerpt from a PDF document ${bookContextText}:
"${text}"

Provide a clear, high-quality, dual-language explanation in BOTH English AND ${targetName}:

REQUIREMENTS FOR EACH LANGUAGE:
### 📖 Core Meaning & Definition
Explain what this concept or term means in the context of the text.

### 💡 Practical Application & Insights
Provide 2 clear example sentences or application points.${khmerGuideline}

CRITICAL FORMAT REQUIREMENT: Output the English explanation first, followed by the separator line "===SPLIT_LANG_EXPLANATION===", followed by the complete ${targetName} explanation.`;

        const result = await aiProvider.generateText(prompt, context);
        return NextResponse.json({ result });
      }

      case "simplify": {
        const hasKhmer = /[\u1780-\u17FF]/.test(text);
        const khmerNote = hasKhmer
          ? "\n\nNOTE: The input contains Khmer. Respond purely in natural standard Khmer (ភាសាខ្មែរ) without any Thai Unicode characters (U+0E00-U+0E7F)."
          : "";

        const bookContextText = bookTitle
          ? `(from the book "${bookTitle}"${author ? ` by ${author}` : ""}${page ? `, Page ${page}` : ""})`
          : "";

        const prompt = `You are analyzing the following excerpt from a PDF document ${bookContextText}:
"${text}"

Rephrase and simplify this passage into plain, easy-to-understand language while preserving its exact core meaning:

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
