import { NextResponse } from "next/server";
import { getPublicFolderId } from "@/lib/owner";
import { getPublicBooks } from "@/lib/booksService";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/books — the owner's library, served read-only to anyone.
 * Reads the publicly-shared eBookMine folder with the API key (no token).
 */
export async function GET() {
  const folderId = getPublicFolderId();
  if (!folderId) {
    return NextResponse.json({ books: [], configured: false }, { status: 200 });
  }

  try {
    const books = await getPublicBooks(folderId);
    return NextResponse.json({ books, configured: true });
  } catch (err: any) {
    return NextResponse.json(
      { books: [], configured: true, error: err?.message ?? "Failed" },
      { status: 500 }
    );
  }
}
