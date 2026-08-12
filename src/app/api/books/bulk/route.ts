import { NextRequest, NextResponse } from "next/server";
import { deleteFile } from "@/lib/drive";
import { getMergedBooks, deleteDbBook } from "@/lib/booksService";
import { requireAuth } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";
import { cleanTitle } from "@/lib/title";
import { slugify } from "@/lib/bookSyncService";

export const dynamic = "force-dynamic";

/**
 * POST /api/books/bulk — apply bulk operations in PostgreSQL.
 * Body:
 *   { op: "tidyTitles" }
 *   { op: "addTag",    ids: string[], tag: string }
 *   { op: "removeTag", ids: string[], tag: string }
 *   { op: "delete",    ids: string[] }
 */
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const token = session.accessToken ?? "";
  const { op, ids, tag } = await req.json();
  const targetIds = Array.isArray(ids) ? ids : [];

  switch (op) {
    case "tidyTitles": {
      const allBooks = await prisma.book.findMany();
      for (const b of allBooks) {
        const tidied = cleanTitle(b.fileName || b.title);
        if (tidied !== b.title) {
          await prisma.book.update({
            where: { id: b.id },
            data: { title: tidied },
          });
        }
      }
      break;
    }
    case "addTag": {
      if (!tag) return NextResponse.json({ error: "Missing tag" }, { status: 400 });
      const catSlug = slugify(tag);
      const category = await prisma.category.upsert({
        where: { slug: catSlug },
        update: { name: tag },
        create: { name: tag, slug: catSlug },
      });

      const matchedBooks = await prisma.book.findMany({
        where: {
          OR: [{ id: { in: targetIds } }, { driveFileId: { in: targetIds } }],
        },
      });

      for (const b of matchedBooks) {
        await prisma.bookCategory.upsert({
          where: { bookId_categoryId: { bookId: b.id, categoryId: category.id } },
          update: {},
          create: { bookId: b.id, categoryId: category.id },
        });
      }
      break;
    }
    case "removeTag": {
      if (!tag) return NextResponse.json({ error: "Missing tag" }, { status: 400 });
      const catSlug = slugify(tag);
      const category = await prisma.category.findUnique({ where: { slug: catSlug } });
      if (category) {
        const matchedBooks = await prisma.book.findMany({
          where: {
            OR: [{ id: { in: targetIds } }, { driveFileId: { in: targetIds } }],
          },
        });
        const matchedIds = matchedBooks.map((b) => b.id);
        await prisma.bookCategory.deleteMany({
          where: {
            categoryId: category.id,
            bookId: { in: matchedIds },
          },
        });
      }
      break;
    }
    case "delete": {
      for (const id of targetIds) {
        if (token) {
          try {
            await deleteFile(token, id);
          } catch {
            /* best-effort */
          }
        }
        await deleteDbBook(id);
      }
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  }

  const books = await getMergedBooks(token, { userId: session.user?.id });
  return NextResponse.json({ books });
}
