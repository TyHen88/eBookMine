import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authHelpers";
import { getIngestionStatus } from "@/lib/rag/ingestionService";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/rag/status?bookId=... — retrieve ingestion status and chunk count.
 */
export async function GET(req: NextRequest) {
  const { response } = await requireUser();
  if (response) return response;

  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) {
    return NextResponse.json({ error: "Missing bookId parameter" }, { status: 400 });
  }

  try {
    const status = await getIngestionStatus(bookId);
    if (!status) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch status" }, { status: 500 });
  }
}
