import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";
import { memoryCache } from "@/lib/cache";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/books — Server-side paginated books with exact counts & in-memory caching.
 * Query params: page=1, limit=25, search="", status="all"
 */
export async function GET(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "25", 10)));
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "all";

    const cacheKey = `admin_books_p${page}_l${limit}_s${encodeURIComponent(search)}_st${status}`;
    const cachedData = memoryCache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Build Prisma Where Clause
    const where: any = {};
    if (status === "published") {
      where.published = true;
    } else if (status === "draft") {
      where.published = false;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        {
          authors: {
            some: { author: { name: { contains: search, mode: "insensitive" } } },
          },
        },
        {
          categories: {
            some: { category: { name: { contains: search, mode: "insensitive" } } },
          },
        },
      ];
    }

    // Execute queries in parallel
    const [totalMatching, totalBooks, publishedCount, draftCount, driveSyncedCount, booksRaw] =
      await Promise.all([
        prisma.book.count({ where }),
        prisma.book.count(),
        prisma.book.count({ where: { published: true } }),
        prisma.book.count({ where: { published: false } }),
        prisma.book.count({ where: { driveFileId: { not: null } } }),
        prisma.book.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { createdAt: "desc" },
          include: {
            authors: { include: { author: true } },
            categories: { include: { category: true } },
          },
        }),
      ]);

    const books = booksRaw.map((b) => ({
      id: b.id,
      driveFileId: b.driveFileId,
      title: b.title,
      description: b.description || "",
      author: b.authors[0]?.author.name || "Unknown",
      category: b.categories[0]?.category.name || "General",
      visibility: b.visibility,
      published: b.published,
      createdAt: b.createdAt,
    }));

    const totalPages = Math.ceil(totalMatching / limit) || 1;

    const payload = {
      ok: true,
      books,
      pagination: {
        page,
        limit,
        totalMatching,
        totalPages,
      },
      counts: {
        totalBooks,
        publishedCount,
        draftCount,
        driveSyncedCount,
      },
    };

    // Cache for 30 seconds
    memoryCache.set(cacheKey, payload, 30);

    return NextResponse.json(payload);
  } catch (err: unknown) {
    logger.error("GET /api/admin/books failed", err);
    const msg = err instanceof Error ? err.message : "Database query error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
