import { Metadata } from "next";
import BookDetail from "@/components/BookDetail";
import { prisma } from "@/lib/db";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ title?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { title: urlTitle } = await searchParams;

  let title = urlTitle || "";
  let author = "";
  let coverUrl = "";

  try {
    const book = await prisma.book.findFirst({
      where: { OR: [{ id }, { driveFileId: id }] },
      include: { authors: { include: { author: true } } },
    });
    if (book) {
      title = book.title;
      author = book.authors[0]?.author.name || "";
      coverUrl = book.coverUrl || `/api/public/books/${book.id}/thumb`;
    }
  } catch {}

  const displayTitle = title ? `${title} — eBookMine` : "eBookMine — Read & Understand Books with AI";
  const description = title
    ? `Read and study "${title}"${author ? ` by ${author}` : ""} on eBookMine. Interactive reading, instant AI Assistanting, multi-page vector search, and smart flashcards.`
    : "Your personal eBook reading library powered by AI. Read, analyze, and retain knowledge effectively.";

  return {
    title: displayTitle,
    description,
    openGraph: {
      title: displayTitle,
      description,
      type: "article",
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: displayTitle,
      description,
    },
  };
}

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookDetail id={id} />;
}
