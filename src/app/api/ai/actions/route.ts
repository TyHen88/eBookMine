import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { aiProvider, checkAndTrackUsage } from "@/lib/ai/aiService";
import { BookContext } from "@/lib/ai/aiProvider";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/actions — execute quick AI actions (explain, simplify, translate, quiz, flashcards).
 * Body: { action: "explain"|"simplify"|"translate"|"quiz"|"flashcards", text, page, bookTitle, author }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { action, text, page, bookTitle, author } = await req.json();
    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    await checkAndTrackUsage(user.id, action, 200);

    const context: BookContext = {
      bookTitle,
      author,
      page,
      selectedText: text,
    };

    switch (action) {
      case "explain": {
        const result = await aiProvider.generateText(
          `Explain the following excerpt in detail:\n\n${text}`,
          context
        );
        return NextResponse.json({ result });
      }
      case "simplify": {
        const result = await aiProvider.generateSummary(text || "Page content", context);
        return NextResponse.json({ result });
      }
      case "translate": {
        const result = await aiProvider.generateText(
          `Translate the following passage into English clearly:\n\n${text}`,
          context
        );
        return NextResponse.json({ result });
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
