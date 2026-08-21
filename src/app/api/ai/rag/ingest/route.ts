import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { requireUser } from "@/lib/authHelpers";
import { ingestBookChunks } from "@/lib/rag/ingestionService";
import { fillLowDensityPagesWithOcr } from "@/lib/rag/ocrFallbackService";
import { getLocalBookFilePath } from "@/lib/localStorage";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/rag/ingest — ingest extracted page text chunks into PostgreSQL ContentChunk vector store.
 * Body: { bookId: string, pages: Array<{ page: number, chapter?: string, text: string }>, pdfBase64?: string }
 */
export async function POST(req: NextRequest) {
  const { response } = await requireUser();
  if (response) return response;

  try {
    const { bookId, pages, pdfBase64 } = await req.json();
    if (!bookId || !Array.isArray(pages)) {
      return NextResponse.json({ error: "Missing bookId or pages array" }, { status: 400 });
    }

    // Retrieve raw PDF buffer if available for OCR fallback on scanned pages
    let pdfBuffer: Buffer | null = null;
    if (pdfBase64 && typeof pdfBase64 === "string") {
      pdfBuffer = Buffer.from(pdfBase64, "base64");
    } else {
      const localFilePath = getLocalBookFilePath(bookId);
      if (localFilePath && fs.existsSync(localFilePath)) {
        try {
          pdfBuffer = await fs.promises.readFile(localFilePath);
        } catch {
          /* Fallback if local file read fails */
        }
      }
    }

    // Fill low-density scanned pages with OCR text if PDF buffer is available
    let processedPages = pages;
    if (pdfBuffer) {
      processedPages = await fillLowDensityPagesWithOcr(pdfBuffer, pages);
    }

    const result = await ingestBookChunks(bookId, processedPages);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Ingestion Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
