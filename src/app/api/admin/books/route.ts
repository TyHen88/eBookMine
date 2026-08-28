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
      language: b.language || "en",
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

/**
 * POST /api/admin/books — Create a new book record in PostgreSQL.
 */
export async function POST(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const body = await req.json();
    const { title, author, category, language, description, visibility, published, coverUrl, driveFileId } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }

    const authorName = author && author.trim() ? author.trim() : "Unknown";
    const catName = category && category.trim() ? category.trim() : "General";
    const lang = language && language.trim() ? language.trim().toLowerCase() : "en";

    // 1. Author upsert
    const dbAuthor = await prisma.author.upsert({
      where: { name: authorName },
      update: {},
      create: { name: authorName },
    });

    // 2. Category upsert
    const catSlug = catName.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").trim() || "general";
    const dbCategory = await prisma.category.upsert({
      where: { slug: catSlug },
      update: { name: catName },
      create: { name: catName, slug: catSlug },
    });

    // 3. Create Book
    const dbBook = await prisma.book.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        fileName: `${title.trim()}.pdf`,
        coverUrl: coverUrl?.trim() || null,
        language: lang,
        visibility: visibility || "PUBLIC",
        published: published !== false,
        driveFileId: driveFileId?.trim() || null,
      },
    });

    // 4. Link relations
    await prisma.bookAuthor.create({
      data: { bookId: dbBook.id, authorId: dbAuthor.id },
    });
    await prisma.bookCategory.create({
      data: { bookId: dbBook.id, categoryId: dbCategory.id },
    });

    memoryCache.invalidate();
    logger.info("Admin created book", { bookId: dbBook.id, title: dbBook.title });

    return NextResponse.json({
      ok: true,
      book: {
        id: dbBook.id,
        title: dbBook.title,
        author: dbAuthor.name,
        category: dbCategory.name,
        language: dbBook.language,
        visibility: dbBook.visibility,
        published: dbBook.published,
      },
    });
  } catch (err: unknown) {
    logger.error("POST /api/admin/books failed", err);
    const msg = err instanceof Error ? err.message : "Failed to create book";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
