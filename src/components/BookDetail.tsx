"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookMeta } from "@/lib/types";
import Header from "./Header";
import BookCard from "./BookCard";
import LearningDashboard from "./LearningDashboard";
import { buttonClass, Chip, Spinner } from "./ui";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  DownloadIcon,
  SparklesIcon,
  BookmarkIcon,
} from "./ui/icons";

type DetailTab = "overview" | "ai" | "notes" | "bookmarks" | "study";

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
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
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

  const pct = book && book.pageCount && book.lastPage > 1 ? Math.min(100, Math.round((book.lastPage / book.pageCount) * 100)) : 0;
  const coverSrc = book ? book.cover ?? `${apiBase}/${book.id}/thumb` : null;
  const downloadHref = book
    ? `/api/public/books/${book.id}/file?download=1&name=${encodeURIComponent(book.title)}`
    : "#";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link
          href="/"
          className={`mb-6 inline-flex ${buttonClass({
            variant: "ghost",
            size: "sm",
          })}`}
        >
          <ArrowLeftIcon size={16} />
          Back to Library
        </Link>

        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : !book ? (
          <div className="flex flex-col items-center py-24 text-center text-slate-500">
            <p className="mt-4 text-base font-bold">Book not found in library.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Hero Card Workspace */}
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/90 sm:p-8">
              <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
                {/* Cover Image */}
                <div className="mx-auto w-44 shrink-0 sm:mx-0">
                  {coverSrc && !coverFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverSrc}
                      alt={book.title}
                      onError={() => setCoverFailed(true)}
                      className="aspect-[3/4] w-full rounded-2xl object-cover shadow-xl ring-1 ring-slate-900/10"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 p-4 text-center text-white">
                      <span className="line-clamp-4 text-xs font-bold">{book.title}</span>
                    </div>
                  )}

                  {pct > 0 && (
                    <div className="mt-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-brand-600 to-brand-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-center text-[11px] font-bold text-slate-500">
                        {pct}% Completed
                      </p>
                    </div>
                  )}
                </div>

                {/* Info & Actions */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                      {book.title}
                    </h1>
                    {authorLabel(book.author) && (
                      <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        by <span className="font-semibold text-slate-800 dark:text-slate-200">{book.author}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {book.category && book.category !== "Other" && (
                      <Chip tone="neutral">{book.category}</Chip>
                    )}
                    {book.tags.map((t) => (
                      <Chip key={t}>{t}</Chip>
                    ))}
                  </div>

                  {/* Primary & Secondary Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      href={`/read/${book.id}`}
                      className={`flex-1 sm:flex-none ${buttonClass({ variant: "primary", size: "lg" })}`}
                    >
                      <BookOpenIcon size={18} />
                      {pct > 0 ? "Continue Reading" : "Start Reading"}
                    </Link>

                    <Link
                      href="/ai-tutor"
                      className={`flex-1 sm:flex-none ${buttonClass({ variant: "secondary", size: "lg" })}`}
                    >
                      <SparklesIcon size={18} className="text-amber-500" />
                      Ask AI Tutor
                    </Link>

                    <a
                      href={downloadHref}
                      className={buttonClass({ variant: "ghost", size: "lg" })}
                      title="Download PDF"
                    >
                      <DownloadIcon size={20} />
                    </a>
                  </div>

                  {/* Details Specs */}
                  <div className="grid grid-cols-2 gap-4 pt-4 text-xs sm:grid-cols-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="block text-[11px] text-slate-400">Page Count</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{book.pageCount || "—"}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">File Size</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatBytes(book.sizeBytes)}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Date Added</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(book.addedAt)}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Current Position</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">Page {book.lastPage}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workspace Tabs Section */}
            <div className="space-y-4">
              <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                {(["overview", "study", "notes", "bookmarks"] as DetailTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`border-b-2 px-5 py-3 text-xs font-bold transition-all capitalize whitespace-nowrap ${
                      activeTab === tab
                        ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {tab === "overview" ? "Overview & Related" : tab === "study" ? "Learning Tools & Quiz" : tab}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <div className="space-y-6">
                  {related.length > 0 && (
                    <div>
                      <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Related Books</h3>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                        {related.map((r, i) => (
                          <BookCard
                            key={r.id}
                            book={r}
                            view="grid"
                            index={i}
                            readOnly={!isOwner}
                            onToggleFavorite={() => {}}
                            onEdit={() => {}}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "study" && (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <LearningDashboard bookId={book.id} />
                </div>
              )}

              {activeTab === "notes" && (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Book Notes</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Open this book in the reader to highlight quotes and save notes attached to specific pages.
                  </p>
                </div>
              )}

              {activeTab === "bookmarks" && (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Bookmarks</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your saved bookmarks for quick page navigation.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
        {value}
      </dd>
    </div>
  );
}
