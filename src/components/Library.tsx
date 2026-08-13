"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookMeta } from "@/lib/types";
import BookCard from "./BookCard";
import UploadZone from "./UploadZone";
import BookDetailModal from "./BookDetailModal";
import ImportFromDrive from "./ImportFromDrive";
import { Button, SearchInput, Select, Spinner } from "./ui";
import {
  BookOpenIcon,
  GridIcon,
  ListIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
} from "./ui/icons";

const PAGE_SIZE = 12;

type ShelfTab = "all" | "reading" | "unread" | "completed" | "favorites";
type SortOption = "recent" | "last_read" | "title" | "author" | "progress";

export default function Library() {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ShelfTab>("all");
  const [category, setCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState<BookMeta | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [continueItems, setContinueItems] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/books")
      .then((r) => r.json())
      .then((d) => setBooks(d.books ?? []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));

    fetch("/api/reading/continue")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setContinueItems(d.items);
      })
      .catch(() => {});
  }, []);

  // Most recent continue item for top Hero banner
  const topContinue = continueItems.length > 0 ? continueItems[0] : null;

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.category && b.category !== "Other") set.add(b.category);
    });
    return Array.from(set).sort();
  }, [books]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, activeTab, category, sortBy]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = books.filter((b) => {
      const pct = b.pageCount && b.lastPage > 1 ? Math.min(100, Math.round((b.lastPage / b.pageCount) * 100)) : 0;
      const isCompleted = pct >= 98;
      const isReading = pct > 0 && !isCompleted;
      const isUnread = pct === 0;

      if (activeTab === "favorites" && !b.favorite) return false;
      if (activeTab === "completed" && !isCompleted) return false;
      if (activeTab === "reading" && !isReading) return false;
      if (activeTab === "unread" && !isUnread) return false;

      if (category && (b.category || "Other") !== category) return false;
      if (q && !`${b.title} ${b.author}`.toLowerCase().includes(q)) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "author") return (a.author || "").localeCompare(b.author || "");
      if (sortBy === "progress") {
        const pctA = a.pageCount ? a.lastPage / a.pageCount : 0;
        const pctB = b.pageCount ? b.lastPage / b.pageCount : 0;
        return pctB - pctA;
      }
      return 0; // Default recent order preserved
    });

    return result;
  }, [books, query, activeTab, category, sortBy]);

  const hasMore = filteredAndSorted.length > visible;

  const handleToggleFavorite = async (book: BookMeta) => {
    const nextFav = !book.favorite;
    setBooks((prev) =>
      prev.map((b) => (b.id === book.id ? { ...b, favorite: nextFav } : b))
    );

    await fetch(`/api/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: nextFav }),
    }).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      {/* Library Title Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Personal Library
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Your personal reading space • Read, understand, and remember.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ImportFromDrive onImported={() => window.location.reload()} />
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <PlusIcon size={16} />
            Upload PDF
          </Button>
        </div>
      </div>

      {/* Continue Reading Hero Banner */}
      {topContinue ? (
        <div className="group relative overflow-hidden rounded-3xl border border-brand-200/80 bg-gradient-to-r from-brand-600 to-brand-500 p-6 text-white shadow-xl shadow-brand-500/20">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {topContinue.book.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={topContinue.book.cover}
                  alt={topContinue.book.title}
                  className="h-24 w-16 rounded-xl object-cover shadow-lg ring-2 ring-white/30"
                />
              ) : (
                <div className="flex h-24 w-16 items-center justify-center rounded-xl bg-white/20 font-bold text-xs text-white">
                  eBook
                </div>
              )}

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">
                  <BookOpenIcon size={12} /> Continue Reading
                </span>
                <h2 className="line-clamp-1 text-lg font-bold text-white">
                  {topContinue.book.title}
                </h2>
                <p className="text-xs text-brand-100">{topContinue.book.author || "Unknown Author"}</p>
                <div className="pt-2 flex items-center gap-3 text-xs">
                  <span className="font-semibold">
                    Page {topContinue.progress.currentPage} / {topContinue.progress.totalPages}
                  </span>
                  <span>•</span>
                  <span className="font-bold">{topContinue.progress.progressPercentage}% Completed</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/read/${topContinue.book.id}`}
                className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-brand-700 shadow-md transition-all hover:bg-brand-50 hover:shadow-lg active:scale-95"
              >
                <BookOpenIcon size={16} /> Continue Reading
              </Link>
              <Link
                href={`/book/${topContinue.book.id}`}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/20"
              >
                <SparklesIcon size={15} /> Ask AI
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State for New Users */
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <BookOpenIcon size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Start your learning journey</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            Choose a book from your library and eBookMine will help you read, understand, and remember it.
          </p>
        </div>
      )}

      {/* Upload Zone Drawer */}
      {showUpload && (
        <div className="rounded-3xl border border-brand-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload New Book to Library</h3>
            <button onClick={() => setShowUpload(false)} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <UploadZone onUploaded={() => { setShowUpload(false); window.location.reload(); }} />
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-4">
        {/* Shelf Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(["all", "reading", "unread", "completed", "favorites"] as ShelfTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all capitalize ${
                  activeTab === t
                    ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {t === "all" ? "All Books" : t === "reading" ? "Currently Reading" : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("grid")}
              className={`rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                view === "grid" ? "text-brand-600 bg-brand-50 dark:bg-brand-950" : ""
              }`}
            >
              <GridIcon size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                view === "list" ? "text-brand-600 bg-brand-50 dark:bg-brand-950" : ""
              }`}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>

        {/* Search Input & Select Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books, authors, or topics..."
          />

          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categoriesList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>

          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="recent">Sort by Recently Added</option>
            <option value="progress">Sort by Progress %</option>
            <option value="title">Sort by Title</option>
            <option value="author">Sort by Author</option>
          </Select>
        </div>
      </div>

      {/* Book Grid / List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 p-12 text-center text-xs text-slate-500 dark:border-slate-800">
          No books found matching your current filter criteria.
        </div>
      ) : (
        <div
          className={
            view === "grid"
              ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              : "space-y-3"
          }
        >
          {filteredAndSorted.slice(0, visible).map((book, idx) => (
            <BookCard
              key={book.id}
              book={book}
              view={view}
              index={idx}
              onToggleFavorite={handleToggleFavorite}
              onEdit={(b) => setEditing(b)}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!loading && hasMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Showing {Math.min(visible, filteredAndSorted.length)} of {filteredAndSorted.length} books
          </p>
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-600 hover:shadow-md active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
            Load More Books
          </button>
        </div>
      )}

      {editing && (
        <BookDetailModal
          book={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await fetch(`/api/books/${editing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patch),
            });
            setEditing(null);
            window.location.reload();
          }}
          onDelete={async () => {
            await fetch(`/api/books/${editing.id}`, { method: "DELETE" });
            setEditing(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
