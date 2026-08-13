import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { memoryCache } from "@/lib/cache";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/books/search?q=... — Fast, debounced, cached book search by Title or Author.
 * Optimized against N+1 queries using targeted projections and memory caching.
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    if (!q) {
      return NextResponse.json({ books: [] });
    }

    const cacheKey = `book_search_q_${q}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Perform targeted query returning strictly needed fields (no N+1 joins)
    const booksRaw = await prisma.book.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          {
            authors: {
              some: { author: { name: { contains: q, mode: "insensitive" } } },
            },
          },
        ],
      },
      select: {
        id: true,
        driveFileId: true,
        title: true,
        coverUrl: true,
        authors: {
          select: {
            author: { select: { name: true } },
          },
          take: 1,
        },
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    const books = booksRaw.map((b) => ({
      id: b.id,
      driveFileId: b.driveFileId,
      title: b.title,
      coverUrl: b.coverUrl,
      author: b.authors[0]?.author?.name || "Unknown",
    }));

    const result = { ok: true, books };

    // Cache search results in-memory for 60 seconds
    memoryCache.set(cacheKey, result, 60);

    return NextResponse.json(result);
  } catch (err: unknown) {
    logger.error("GET /api/public/books/search failed", err);
    return NextResponse.json({ ok: false, error: "Search query error" }, { status: 500 });
  }
}
