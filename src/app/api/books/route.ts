import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAppFolder, uploadFile } from "@/lib/drive";
import { getMergedBooks, createDbBook } from "@/lib/booksService";
import { requireAuth } from "@/lib/authHelpers";
import { bookCreateSchema } from "@/lib/validation";
import { saveLocalBookFile } from "@/lib/localStorage";
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
 * POST /api/books — upload a new PDF (Google Drive or Local Storage) & create record in PostgreSQL.
 * Expects multipart/form-data: `file` (the PDF) + `meta` (JSON string).
 */
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

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

    const bytes = await file.arrayBuffer();
    const token = session.accessToken;
    let driveFileId: string | null = null;
    let fileSize = bytes.byteLength;

    // 1. Try Google Drive if an OAuth access token is available
    if (token) {
      try {
        const folderId = await getOrCreateAppFolder(token);
        const uploaded = await uploadFile(
          token,
          folderId,
          file.name,
          "application/pdf",
          bytes
        );
        if (uploaded?.id) {
          driveFileId = uploaded.id;
          if (uploaded.size) fileSize = parseInt(uploaded.size, 10);
        }
      } catch (driveErr) {
        logger.warn("Google Drive upload failed, falling back to local storage", {
          error: driveErr instanceof Error ? driveErr.message : String(driveErr),
        });
      }
    }

    // 2. Fallback to Local File Storage if Drive is unavailable or session lacks OAuth token
    if (!driveFileId) {
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await saveLocalBookFile(localId, bytes);
      driveFileId = localId;
    }

    const book = await createDbBook({
      driveFileId,
      title: meta.title || file.name.replace(/\.pdf$/i, ""),
      fileName: file.name,
      author: meta.author,
      category: meta.category,
      pageCount: meta.pageCount || 0,
      sizeBytes: fileSize,
      coverUrl: meta.cover || null,
      userId: session.user?.id,
    });

    logger.info("Book created successfully", { bookId: book.id, title: book.title, driveFileId });
    return NextResponse.json({ book });
  } catch (err) {
    logger.error("POST /api/books failed", err);
    const msg = err instanceof Error ? err.message : "Book upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
