import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { ingestBookChunks } from "@/lib/rag/ingestionService";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/rag/ingest — ingest extracted page text chunks into PostgreSQL ContentChunk vector store.
 * Body: { bookId: string, pages: Array<{ page: number, chapter?: string, text: string }> }
 */
export async function POST(req: NextRequest) {
  const { response } = await requireUser();
  if (response) return response;

  try {
    const { bookId, pages } = await req.json();
    if (!bookId || !Array.isArray(pages)) {
      return NextResponse.json({ error: "Missing bookId or pages array" }, { status: 400 });
    }

    const result = await ingestBookChunks(bookId, pages);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Ingestion Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
