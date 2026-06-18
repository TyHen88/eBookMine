import { NextResponse } from "next/server";
import { getOwnerAccessToken } from "@/lib/owner";
import { getMergedBooks } from "@/lib/booksService";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/books — the owner's library, served read-only to anyone.
 * Uses the owner's stored token; never writes back to library.json.
 */
export async function GET() {
  const token = await getOwnerAccessToken();
  if (!token) {
    return NextResponse.json(
      { books: [], configured: false },
      { status: 200 }
    );
  }

  try {
    const books = await getMergedBooks(token, { persist: false });
    return NextResponse.json({ books, configured: true });
  } catch (err: any) {
    return NextResponse.json(
      { books: [], configured: true, error: err?.message ?? "Failed" },
      { status: 500 }
    );
  }
}
