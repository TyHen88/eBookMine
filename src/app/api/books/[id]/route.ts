import { NextRequest, NextResponse } from "next/server";
import { renameFile } from "@/lib/drive";
import { updateDbBook, deleteDbBook } from "@/lib/booksService";
import { requireAuth } from "@/lib/authHelpers";
import { bookUpdateSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/books/[id] — update mutable metadata in PostgreSQL.
 * Body: partial { title, author, category, tags, favorite, lastPage, bookmarks, renameFileTo, published, visibility }.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  try {
    const patch = await req.json();

    // Validate with Zod (partial fields accepted)
    const validation = bookUpdateSchema.safeParse(patch);
    // Log but don't reject — allow extra fields for backwards compat
    if (!validation.success) {
      logger.warn("PATCH /api/books validation warnings", {
        bookId: id,
        issues: validation.error.issues,
      });
    }

    const token = session.accessToken;

    // If the file was renamed, rename it in Drive
    if (token && typeof patch.renameFileTo === "string" && patch.renameFileTo.trim()) {
      const newName = patch.renameFileTo.endsWith(".pdf")
        ? patch.renameFileTo
        : `${patch.renameFileTo}.pdf`;
      try {
        await renameFile(token, id, newName);
      } catch {
        /* Drive rename is best-effort */
      }
    }

    const updated = await updateDbBook(id, patch, session.user?.id);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ book: updated });
  } catch (err) {
    logger.error("PATCH /api/books/[id] failed", err, { bookId: id });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/books/[id] — remove the book record from PostgreSQL.
 *
 * IMPORTANT: Deleting book metadata does NOT delete the Google Drive PDF.
 * This separates database metadata from physical file storage.
 * The PDF can be manually removed from Google Drive if desired.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  try {
    await deleteDbBook(id);
    logger.info("Book metadata deleted", { bookId: id, userId: session.user?.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("DELETE /api/books/[id] failed", err, { bookId: id });
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
