import { NextRequest, NextResponse } from "next/server";
import { requireUser, getSession } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";
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
 * Body: { bookId, page, selectedText, message, prompt, bookTitle, author, chatHistory }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const user = session?.user?.email
      ? await prisma.user.findUnique({ where: { email: session.user.email } })
      : null;

    const body = await req.json();

    // Validate input with Zod
    const validation = aiChatSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }

    const { bookId, page, selectedText, message: rawMessage, prompt: rawPrompt, bookTitle, author, chatHistory } = validation.data;
    const message = (rawMessage || rawPrompt || "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    // Rate limiting & cost control check for authenticated users
    if (user) {
      try {
        await checkAndTrackUsage(user.id, "chat", 300);
      } catch (usageErr: any) {
        return NextResponse.json(
          { error: usageErr.message || "Daily AI limit reached" },
          { status: 429 }
        );
      }
    }

    let conversation: any = null;
    if (user) {
      try {
        conversation = await getOrCreateConversation(user.id, bookId);
        await saveAiMessage(conversation.id, "user", message, page, selectedText);
      } catch {
        /* fallback in-memory */
      }
    }

    const context: BookContext = {
      bookTitle,
      author,
      page,
      selectedText,
    };

    const history: ChatHistoryMessage[] =
      chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0
        ? chatHistory.map((m: any) => ({
            role: (m.role === "assistant" ? "assistant" : "user") as any,
            content: m.content,
          }))
        : (conversation?.messages || []).map((m: any) => ({
            role: (m.role === "assistant" ? "assistant" : "user") as any,
            content: m.content,
          }));

    // Generate AI response
    const reply = await aiProvider.answerBookQuestion(
      message,
      history,
      context
    );

    let assistantMsg: any = null;
    if (conversation) {
      try {
        assistantMsg = await saveAiMessage(
          conversation.id,
          "assistant",
          reply,
          page,
          selectedText
        );
      } catch {
        /* fallback */
      }
    }

    return NextResponse.json({
      reply,
      result: reply,
      message: assistantMsg || { role: "assistant", content: reply, page },
    });
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
