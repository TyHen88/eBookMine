import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAppFolder, uploadFile } from "@/lib/drive";
import { getMergedBooks, createDbBook } from "@/lib/booksService";
import { requireAuth } from "@/lib/authHelpers";
import { bookCreateSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/books — return books from Neon PostgreSQL.
 */
export async function GET() {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const token = session.accessToken ?? "";
    const books = await getMergedBooks(token, { userId: session.user?.id });
    return NextResponse.json({ books });
  } catch (err) {
    logger.error("GET /api/books failed", err);
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
  }
}

/**
 * POST /api/books — upload a new PDF to Google Drive & create record in PostgreSQL.
 * Expects multipart/form-data: `file` (the PDF) + `meta` (JSON string).
 */
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const token = session.accessToken;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const metaRaw = form.get("meta") as string | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    // Validate file type
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    // Validate meta payload with Zod
    let meta: Record<string, any> = {};
    if (metaRaw) {
      try {
        const parsed = JSON.parse(metaRaw);
        const result = bookCreateSchema.safeParse(parsed);
        if (result.success) meta = result.data;
        else meta = parsed; // fallback: use raw meta for backwards compat
      } catch {
        return NextResponse.json({ error: "Invalid meta JSON" }, { status: 400 });
      }
    }

    const folderId = await getOrCreateAppFolder(token);
    const bytes = await file.arrayBuffer();

    const uploaded = await uploadFile(
      token,
      folderId,
      file.name,
      "application/pdf",
      bytes
    );

    const book = await createDbBook({
      driveFileId: uploaded.id,
      title: meta.title || file.name,
      fileName: file.name,
      author: meta.author,
      category: meta.category,
      pageCount: meta.pageCount || 0,
      sizeBytes: uploaded.size ? parseInt(uploaded.size, 10) : bytes.byteLength,
      coverUrl: meta.cover || null,
      userId: session.user?.id,
    });

    logger.info("Book created", { bookId: book.id, title: book.title });
    return NextResponse.json({ book });
  } catch (err) {
    logger.error("POST /api/books failed", err);
    return NextResponse.json({ error: "Book upload failed" }, { status: 500 });
  }
}
