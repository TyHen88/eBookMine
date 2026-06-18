import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { getOrCreateAppFolder, uploadFile } from "@/lib/drive";
import { loadLibrary, saveLibrary, BookMeta } from "@/lib/metadata";
import { cleanTitle } from "@/lib/title";
import { categorize } from "@/lib/categorize";
import { getMergedBooks } from "@/lib/booksService";

export const dynamic = "force-dynamic";

/**
 * GET /api/books — return the merged library (metadata + any orphan PDFs in Drive).
 */
export async function GET() {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const books = await getMergedBooks(token, { persist: true });
  return NextResponse.json({ books });
}

/**
 * POST /api/books — upload a new PDF.
 * Expects multipart/form-data: `file` (the PDF) + `meta` (JSON string).
 */
export async function POST(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const metaRaw = form.get("meta") as string | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const meta = metaRaw ? JSON.parse(metaRaw) : {};
  const folderId = await getOrCreateAppFolder(token);
  const bytes = await file.arrayBuffer();

  const uploaded = await uploadFile(
    token,
    folderId,
    file.name,
    "application/pdf",
    bytes
  );

  const library = await loadLibrary(token, folderId);
  const book: BookMeta = {
    id: uploaded.id,
    title: meta.title || cleanTitle(file.name),
    author: meta.author || "Unknown",
    fileName: file.name,
    pageCount: meta.pageCount || 0,
    category: meta.category || categorize(`${meta.title ?? ""} ${file.name}`),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    favorite: false,
    cover: meta.cover || null,
    addedAt: uploaded.createdTime ?? new Date().toISOString(),
    lastPage: 1,
    bookmarks: [],
    sizeBytes: uploaded.size ? parseInt(uploaded.size, 10) : bytes.byteLength,
  };
  library.books[book.id] = book;
  await saveLibrary(token, folderId, library);

  return NextResponse.json({ book });
}
