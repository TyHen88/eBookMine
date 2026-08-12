import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import {
  aiProvider,
  checkAndTrackUsage,
  getOrCreateConversation,
  saveAiMessage,
  clearConversationHistory,
} from "@/lib/ai/aiService";
import { BookContext, ChatHistoryMessage } from "@/lib/ai/aiProvider";
import { aiChatSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/chat?bookId=... — load conversation history for authenticated user.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const bookId = req.nextUrl.searchParams.get("bookId") ?? undefined;
    const conversation = await getOrCreateConversation(user.id, bookId);
    return NextResponse.json({ conversation });
  } catch (err) {
    logger.error("GET /api/ai/chat failed", err);
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 });
  }
}

/**
 * POST /api/ai/chat — ask AI a question with current book context.
 * Body: { bookId, page, selectedText, message, bookTitle, author }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const body = await req.json();

    // Validate input with Zod
    const validation = aiChatSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues.map(i => i.message) },
        { status: 400 }
      );
    }

    const { bookId, page, selectedText, message, bookTitle, author } = validation.data;

    // Rate limiting & cost control check
    await checkAndTrackUsage(user.id, "chat", 300);

    const conversation = await getOrCreateConversation(user.id, bookId);

    // Save user message
    await saveAiMessage(
      conversation.id,
      "user",
      message,
      page,
      selectedText
    );

    const context: BookContext = {
      bookTitle,
      author,
      page,
      selectedText,
    };

    const history: ChatHistoryMessage[] = conversation.messages.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as any,
      content: m.content,
    }));

    // Generate AI response
    const reply = await aiProvider.answerBookQuestion(
      message,
      history,
      context
    );

    // Save assistant reply
    const assistantMsg = await saveAiMessage(
      conversation.id,
      "assistant",
      reply,
      page,
      selectedText
    );

    return NextResponse.json({ reply, message: assistantMsg });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI Error";
    const status = msg.includes("limit") || msg.includes("rate") ? 429 : 500;
    logger.error("POST /api/ai/chat failed", err);
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * DELETE /api/ai/chat?conversationId=... — clear conversation history.
 */
export async function DELETE(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

  try {
    const ok = await clearConversationHistory(user.id, conversationId);
    return NextResponse.json({ success: ok });
  } catch (err) {
    logger.error("DELETE /api/ai/chat failed", err);
    return NextResponse.json({ error: "Failed to clear conversation" }, { status: 500 });
  }
}
