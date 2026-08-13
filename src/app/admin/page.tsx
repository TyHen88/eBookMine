import { redirect } from "next/navigation";
import { getSession } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();

  const isAdmin = session?.user?.role === "ADMIN" || session?.isOwner === true;
  if (!isAdmin) {
    redirect("/");
  }

  // Server-side initial data fetch with exact count metrics
  let totalBooksCount = 0;
  let publishedCount = 0;
  let draftCount = 0;
  let driveSyncedCount = 0;
  let books: any[] = [];
  let users: any[] = [];
  let categories: any[] = [];
  let authors: any[] = [];
  let aiUsageCount = 0;

  try {
    const results = await Promise.all([
      prisma.book.count(),
      prisma.book.count({ where: { published: true } }),
      prisma.book.count({ where: { published: false } }),
      prisma.book.count({ where: { driveFileId: { not: null } } }),
      prisma.book.findMany({
        take: 25,
        include: {
          authors: { include: { author: true } },
          categories: { include: { category: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.author.findMany({ orderBy: { name: "asc" } }),
      prisma.aIUsage.count(),
    ]);

    totalBooksCount = results[0];
    publishedCount = results[1];
    draftCount = results[2];
    driveSyncedCount = results[3];
    books = results[4];
    users = results[5];
    categories = results[6];
    authors = results[7];
    aiUsageCount = results[8];
  } catch (err: any) {
    console.error("AdminPage DB load warning (will retry on next navigation):", err?.message || err);
  }

  return (
    <AdminClient
      initialBooks={books.map((b) => ({
        id: b.id,
        driveFileId: b.driveFileId,
        title: b.title,
        description: b.description || "",
        author: b.authors[0]?.author.name || "Unknown",
        category: b.categories[0]?.category.name || "General",
        visibility: b.visibility,
        published: b.published,
      }))}
      initialBookCounts={{
        totalBooks: totalBooksCount,
        publishedCount,
        draftCount,
        driveSyncedCount,
      }}
      initialUsers={users}
      initialCategories={categories}
      initialAuthors={authors}
      aiUsageCount={aiUsageCount}
    />
  );
}

