"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { pdfjs } from "@/lib/pdf";
import { BookMeta } from "@/lib/types";
import { BookmarkData, HighlightData, NoteData } from "@/lib/readingService";
import { prefetchPdf } from "@/lib/pdfCache";
import Header from "./Header";
import BookCard from "./BookCard";
import AuthPromptModal from "./AuthPromptModal";
import { buttonClass, Spinner } from "./ui";
import { useToast } from "./ui/Toast";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  DownloadIcon,
  BookmarkIcon,
  ShareIcon,
  ClockIcon,
  FileTextIcon,
  StarIcon,
  TagIcon,
  CheckIcon,
} from "./ui/icons";

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
    month: "short",
    day: "numeric",
  });
}

function estimateReadingTime(pagesLeft: number): string {
  if (pagesLeft <= 0) return "Completed";
  const mins = Math.ceil(pagesLeft * 2.2);
  if (mins < 60) return `~${mins} mins left`;
  const hrs = (mins / 60).toFixed(1);
  return `~${hrs} hrs left`;
}

const authorLabel = (a: string) =>
  a && a.trim() && a.trim().toLowerCase() !== "unknown" ? a : null;

export default function BookDetail({ id }: { id: string }) {
  const { status } = useSession();
  const isOwner = status === "authenticated";
  const apiBase = isOwner ? "/api/books" : "/api/public/books";
  const { showToast } = useToast();

  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverFailed, setCoverFailed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Saved Items for this book
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    fetch(apiBase)
      .then((r) => r.json())
      .then((d) => setBooks((d.books as BookMeta[]) ?? []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, [apiBase, status]);

  const book = useMemo(() => books.find((b) => b.id === id), [books, id]);

  useEffect(() => {
    if (book && book.title && typeof window !== "undefined") {
      const timer = setTimeout(() => setIsFavorite(Boolean(book.favorite)), 0);
      const url = new URL(window.location.href);
      if (url.searchParams.get("title") !== book.title) {
        url.searchParams.set("title", book.title);
        window.history.replaceState(null, "", url.toString());
      }
      return () => clearTimeout(timer);
    }
  }, [book]);

  // AUTO-FETCH Page Count & File Size if missing or 0
  useEffect(() => {
    if (!book) return;

    // 1. Fetch file size via HEAD request if missing/0
    if (!book.sizeBytes || book.sizeBytes === 0) {
      fetch(`${apiBase}/${book.id}/file`, { method: "HEAD" })
        .then((res) => {
          const len = res.headers.get("Content-Length");
          if (len) {
            const size = parseInt(len, 10);
            if (size > 0) {
              setBooks((prev) =>
                prev.map((b) => (b.id === book.id ? { ...b, sizeBytes: size } : b))
              );
            }
          }
        })
        .catch(() => {});
    }

    // 2. Fetch page count via pdf.js if missing/0
    if (!book.pageCount || book.pageCount === 0) {
      const fileUrl = `${apiBase}/${book.id}/file`;
      pdfjs
        .getDocument({ url: fileUrl })
        .promise.then((pdfDoc) => {
          const count = pdfDoc.numPages;
          if (count > 0) {
            setBooks((prev) =>
              prev.map((b) => (b.id === book.id ? { ...b, pageCount: count } : b))
            );
            if (isOwner) {
              fetch(`/api/books/${book.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pageCount: count }),
              }).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  }, [book, apiBase, isOwner]);

  // Fetch Notes, Highlights, and Bookmarks for this book if authenticated
  useEffect(() => {
    if (!id || !isOwner) return;
    const timer = setTimeout(() => setLoadingSaved(true), 0);
    Promise.all([
      fetch(`/api/reading/notes?bookId=${id}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/reading/highlights?bookId=${id}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/reading/bookmarks?bookId=${id}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([nData, hData, bData]) => {
        setNotes(Array.isArray(nData) ? nData : []);
        setHighlights(Array.isArray(hData) ? hData : []);
        setBookmarks(Array.isArray(bData) ? bData : []);
      })
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }, [id, isOwner]);

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

  const pct =
    book && book.pageCount && book.lastPage > 1
      ? Math.min(100, Math.round((book.lastPage / book.pageCount) * 100))
      : 0;

  const pagesRemaining = book ? Math.max(0, (book.pageCount || 0) - (book.lastPage || 1)) : 0;
  const readTimeEst = estimateReadingTime(pagesRemaining);

  const coverSrc = book ? book.cover ?? `${apiBase}/${book.id}/thumb` : null;
  const downloadHref = book
    ? `${apiBase}/${book.id}/file?download=1&name=${encodeURIComponent(book.title)}`
    : "#";

  const handleShare = () => {
    if (typeof window !== "undefined" && book) {
      const shareUrl = `${window.location.origin}/book/${book.id}?title=${encodeURIComponent(book.title)}`;
      navigator.clipboard.writeText(shareUrl);
      showToast(`Copied share link for "${book.title}"!`, "success");
    }
  };

  const toggleFavorite = async () => {
    if (!isOwner) {
      setShowAuthModal(true);
      return;
    }
    if (!book) return;
    const nextFav = !isFavorite;
    setIsFavorite(nextFav);
    try {
      await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: nextFav }),
      });
      showToast(nextFav ? "Added to Favorites" : "Removed from Favorites", "info");
    } catch {
      setIsFavorite(!nextFav);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-5 pb-32 sm:pb-24">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md transition-all hover:bg-slate-100 dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeftIcon size={14} />
            Library
          </Link>

          {book && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-md transition-all hover:border-brand-300 hover:text-brand-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                title="Share link"
              >
                <ShareIcon size={14} />
                <span className="hidden sm:inline">Share</span>
              </button>

              <button
                onClick={toggleFavorite}
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md transition-all ${
                  isFavorite
                    ? "border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-400"
                    : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-amber-300 hover:text-amber-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <StarIcon size={14} filled={isFavorite} />
                <span className="hidden sm:inline">
                  {isFavorite ? "Favorited" : "Favorite"}
                </span>
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Spinner size="md" />
            <p className="text-xs font-semibold text-slate-400 animate-pulse">Loading book details...</p>
          </div>
        ) : !book ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white/60 p-12 text-center shadow-lg backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60">
            <BookOpenIcon size={40} className="text-slate-300 dark:text-slate-700" />
            <h2 className="mt-3 text-base font-extrabold text-slate-800 dark:text-slate-100">
              Book Not Found
            </h2>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              The requested book was not found in your library or might have been removed.
            </p>
            <Link
              href="/"
              className={`mt-4 ${buttonClass({ variant: "primary", size: "sm" })}`}
            >
              Return to Library
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Hero Card Workspace */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/90 sm:p-6">
              <div className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-brand-500/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-amber-500/10 blur-2xl" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
                {/* Cover Image */}
                <div className="group relative mx-auto w-32 shrink-0 sm:mx-0 sm:w-36">
                  <div className="relative overflow-hidden rounded-xl border border-slate-200/60 bg-slate-100 shadow-md transition-transform duration-300 group-hover:scale-[1.02] dark:border-slate-800/60 dark:bg-slate-800">
                    {coverSrc && !coverFailed ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverSrc}
                        alt={book.title}
                        onError={() => setCoverFailed(true)}
                        className="aspect-[3/4] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-700 p-3 text-center text-white shadow-inner">
                        <BookOpenIcon size={24} className="mb-1 text-white/80" />
                        <span className="line-clamp-3 text-[11px] font-bold leading-snug">
                          {book.title}
                        </span>
                      </div>
                    )}

                    {/* Badge Overlay */}
                    <div className="absolute top-2 right-2">
                      {pct >= 100 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[9px] font-bold text-white shadow backdrop-blur-md">
                          <CheckIcon size={10} /> Done
                        </span>
                      ) : pct > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-600/90 px-2 py-0.5 text-[9px] font-bold text-white shadow backdrop-blur-md">
                          {pct}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] font-bold text-white shadow backdrop-blur-md">
                          New
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {pct > 0 && (
                    <div className="mt-2.5 space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-amber-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span>p. {book.lastPage} of {book.pageCount || "—"}</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Book Details */}
                <div className="flex-1 space-y-3 min-w-0">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {book.category && book.category !== "Other" && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                          <TagIcon size={11} />
                          {book.category}
                        </span>
                      )}
                      {book.favorite && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                          <StarIcon size={11} filled /> Favorite
                        </span>
                      )}
                    </div>

                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl leading-snug">
                      {book.title}
                    </h1>

                    {authorLabel(book.author) && (
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        By <span className="font-bold text-slate-800 dark:text-slate-200">{book.author}</span>
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  {book.tags && book.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {book.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons Hub */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      href={`/read/${book.id}`}
                      onMouseEnter={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
                      onTouchStart={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <BookOpenIcon size={15} />
                      {pct > 0 ? `Continue Reading (p. ${book.lastPage})` : "Start Reading"}
                    </Link>

                    <a
                      href={downloadHref}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      title="Download PDF"
                    >
                      <DownloadIcon size={15} />
                      <span>Download PDF</span>
                    </a>
                  </div>
                </div>
              </div>
              {/* Stats Widgets Grid */}
              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800/80 sm:grid-cols-4 sm:gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800/60 dark:bg-slate-800/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-300/90">
                    <BookOpenIcon size={13} className="text-brand-500" />
                    <span>Page Size</span>
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white">
                    {book.pageCount ? `${book.pageCount} pages` : <span className="animate-pulse text-brand-600">Detecting...</span>}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800/60 dark:bg-slate-800/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-300/90">
                    <ClockIcon size={13} className="text-indigo-500" />
                    <span>Est. Time</span>
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white">
                    {readTimeEst}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800/60 dark:bg-slate-800/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-300/90">
                    <FileTextIcon size={13} className="text-purple-500" />
                    <span>File Size</span>
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white">
                    {book.sizeBytes ? formatBytes(book.sizeBytes) : <span className="animate-pulse text-purple-600">Calculating...</span>}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800/60 dark:bg-slate-800/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-300/90">
                    <TagIcon size={13} className="text-amber-500" />
                    <span>Added</span>
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white">
                    {formatDate(book.addedAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Clean Details Section: Recommended Books & Saved Annotations */}
            <div className="space-y-5">
              {/* Recommended & Related Books */}
              {related.length > 0 && (
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80">
                  <h3 className="mb-3 text-sm font-extrabold text-slate-900 dark:text-white">
                    Recommended & Related Books
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
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

              {/* Saved Notes & Bookmarks Summary Card (if any exist) */}
              {isOwner && (notes.length > 0 || bookmarks.length > 0 || highlights.length > 0) && (
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-lg backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Your Saved Annotations & Bookmarks
                    </h3>
                    <Link
                      href={`/read/${book.id}`}
                      onMouseEnter={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
                      onTouchStart={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
                      className="text-xs font-bold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Open in Reader →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400">Notes:</span>
                      <span className="font-bold ml-1.5 text-slate-900 dark:text-white">{notes.length}</span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400">Highlights:</span>
                      <span className="font-bold ml-1.5 text-slate-900 dark:text-white">{highlights.length}</span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400">Bookmarks:</span>
                      <span className="font-bold ml-1.5 text-slate-900 dark:text-white">{bookmarks.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Auth Prompt Modal */}
      {showAuthModal && <AuthPromptModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
