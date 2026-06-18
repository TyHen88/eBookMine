"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookMeta } from "@/lib/types";
import Header from "./Header";
import BookCard from "./BookCard";

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
          className="mb-6 inline-block text-sm font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400"
        >
          ← Back to library
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : !book ? (
          <div className="py-20 text-center text-slate-500">
            <div className="text-5xl">🔍</div>
            <p className="mt-4">Book not found.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-8 sm:flex-row">
              {/* Cover */}
              <div className="mx-auto w-48 shrink-0 sm:mx-0">
                {coverSrc && !coverFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverSrc}
                    alt={book.title}
                    onError={() => setCoverFailed(true)}
                    className="aspect-[3/4] w-full rounded-xl object-cover shadow-md"
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
                        className="h-full rounded-full bg-brand-500"
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
              <div className="min-w-0 flex-1">
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
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {book.category}
                    </span>
                  )}
                  {book.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/read/${book.id}`}
                    className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    {pct > 0 ? "Continue reading" : "Read now"}
                  </Link>
                  <a
                    href={downloadHref}
                    className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    ⬇ Download
                  </a>
                </div>

                {/* Detail table */}
                <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  <Detail label="Pages" value={book.pageCount ? String(book.pageCount) : "—"} />
                  <Detail label="File size" value={formatBytes(book.sizeBytes)} />
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
                <h2 className="mb-4 text-lg font-semibold">Related books</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {related.map((b) => (
                    <BookCard
                      key={b.id}
                      book={b}
                      view="grid"
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
