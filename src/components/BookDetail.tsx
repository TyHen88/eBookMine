"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookMeta } from "@/lib/types";
import Header from "./Header";
import BookCard from "./BookCard";
import { buttonClass, Chip, Spinner } from "./ui";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  DownloadIcon,
  SearchIcon,
} from "./ui/icons";

const UPLOADER = "Hen Ty";

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const authorLabel = (a: string) =>
  a && a.trim() && a.trim().toLowerCase() !== "unknown" ? a : null;

export default function BookDetail({ id }: { id: string }) {
  const { status } = useSession();
  const isOwner = status === "authenticated";
  const apiBase = isOwner ? "/api/books" : "/api/public/books";

  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    fetch(apiBase)
      .then((r) => r.json())
      .then((d) => setBooks((d.books as BookMeta[]) ?? []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, [apiBase, status]);

  const book = useMemo(() => books.find((b) => b.id === id), [books, id]);

  // Related: same category or any shared tag, excluding this book.
  const related = useMemo(() => {
    if (!book) return [];
    return books
      .filter((b) => b.id !== book.id)
      .map((b) => {
        const sharedTags = b.tags.filter((t) => book.tags.includes(t)).length;
        const sameCategory =
          b.category && book.category && b.category === book.category ? 1 : 0;
        return { b, score: sharedTags * 2 + sameCategory };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.b);
  }, [books, book]);

  const coverSrc = book
    ? book.cover ?? `${apiBase}/${book.id}/thumb`
    : null;
  const downloadHref = book
    ? `/api/public/books/${book.id}/file?download=1&name=${encodeURIComponent(book.title)}`
    : "#";
  const pct =
    book && book.pageCount && book.lastPage > 1
      ? Math.min(100, Math.round((book.lastPage / book.pageCount) * 100))
      : 0;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Link
          href="/"
          className="group mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400"
        >
          <ArrowLeftIcon
            size={17}
            className="transition-transform duration-300 group-hover:-translate-x-1"
          />
          Back to library
        </Link>

        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : !book ? (
          <div className="flex flex-col items-center py-24 text-center text-slate-500">
            <SearchIcon size={44} className="text-slate-400" />
            <p className="mt-4">Book not found.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-8 sm:flex-row">
              {/* Cover */}
              <div className="mx-auto w-48 shrink-0 animate-fade-in-up sm:mx-0">
                {coverSrc && !coverFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverSrc}
                    alt={book.title}
                    onError={() => setCoverFailed(true)}
                    className="aspect-[3/4] w-full rounded-xl object-cover shadow-lg shadow-brand-500/20 transition-transform duration-500 hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-300 p-3 text-center dark:from-brand-900 dark:to-brand-700">
                    <span className="line-clamp-5 text-sm font-medium text-brand-900 dark:text-brand-100">
                      {book.title}
                    </span>
                  </div>
                )}
                {pct > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full origin-left animate-bar-grow rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-center text-xs text-slate-400">
                      {pct}% read
                    </p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div
                className="min-w-0 flex-1 animate-fade-in-up"
                style={{ animationDelay: "80ms" }}
              >
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {book.title}
                </h1>
                {authorLabel(book.author) && (
                  <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
                    by {book.author}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {book.category && book.category !== "Other" && (
                    <Chip tone="neutral" className="px-3 py-1 text-sm">
                      {book.category}
                    </Chip>
                  )}
                  {book.tags.map((t) => (
                    <Chip key={t} className="px-3 py-1 text-sm">
                      {t}
                    </Chip>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/read/${book.id}`}
                    className={buttonClass({ variant: "primary", size: "lg" })}
                  >
                    <BookOpenIcon size={18} />
                    {pct > 0 ? "Continue reading" : "Read now"}
                  </Link>
                  <a
                    href={downloadHref}
                    className={buttonClass({ variant: "secondary", size: "lg" })}
                  >
                    <DownloadIcon size={18} />
                    Download
                  </a>
                </div>

                {/* Detail table */}
                <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {book.pageCount > 0 && (
                    <Detail label="Pages" value={String(book.pageCount)} />
                  )}
                  {book.sizeBytes > 0 && (
                    <Detail label="File size" value={formatBytes(book.sizeBytes)} />
                  )}
                  <Detail label="Date added" value={formatDate(book.addedAt)} />
                  <Detail label="Uploaded by" value={UPLOADER} />
                  {book.category && <Detail label="Category" value={book.category} />}
                  <Detail label="Format" value="PDF" />
                </dl>
              </div>
            </div>

            {/* Related books */}
            {related.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-block h-5 w-1 rounded-full bg-gradient-to-b from-brand-500 to-brand-400" />
                  Related books
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {related.map((b, i) => (
                    <BookCard
                      key={b.id}
                      book={b}
                      view="grid"
                      index={i}
                      readOnly
                      onToggleFavorite={() => {}}
                      onEdit={() => {}}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5 dark:border-slate-800 sm:block sm:border-0 sm:py-0">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:mt-0.5">
        {value}
      </dd>
    </div>
  );
}
