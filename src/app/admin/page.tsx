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

  // Server-side initial data fetch
  const [books, users, categories, authors, aiUsageCount] = await Promise.all([
    prisma.book.findMany({
      include: {
        authors: { include: { author: true } },
        categories: { include: { category: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
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
      initialUsers={users}
      initialCategories={categories}
      initialAuthors={authors}
      aiUsageCount={aiUsageCount}
    />
  );
}
