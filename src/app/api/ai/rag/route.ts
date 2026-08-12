import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { chatWithBook } from "@/lib/rag/ragService";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/rag — RAG "Chat with this Book" endpoint.
 * Body: { bookId: string, question: string, page?: number }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  try {
    const { bookId, question, page } = await req.json();
    if (!bookId || !question || typeof question !== "string") {
      return NextResponse.json({ error: "Missing bookId or question" }, { status: 400 });
    }

    const result = await chatWithBook(user.id, bookId, question, page);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "RAG Error";
    logger.error("POST /api/ai/rag failed", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
