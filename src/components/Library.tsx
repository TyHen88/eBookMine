"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookMeta } from "@/lib/types";
import BookCard from "./BookCard";
import BookDetailModal from "./BookDetailModal";
import { Button, SearchInput, Select, Spinner } from "./ui";
import {
  BookOpenIcon,
  GridIcon,
  ListIcon,
  SparklesIcon,
  StarIcon,
} from "./ui/icons";

import { useToast } from "./ui/Toast";
import { useSession } from "next-auth/react";
import BookThumbnailImg from "./BookThumbnailImg";
import { prefetchPdf } from "@/lib/pdfCache";

const PAGE_SIZE = 12;

type ShelfTab = "all" | "reading" | "unread" | "completed" | "favorites";
type SortOption = "recent" | "last_read" | "title" | "author" | "progress";
type LanguageFilter = "all" | "en" | "km";

const TAB_LABELS: Record<ShelfTab, string> = {
  all: "All",
  reading: "Reading",
  unread: "Unread",
  completed: "Done",
  favorites: "Favorites",
};

export default function Library() {
  const { showToast } = useToast();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN" || (session as any)?.isOwner === true;

  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ShelfTab>("all");
  const [category, setCategory] = useState<string>("");
  const [selectedLang, setSelectedLang] = useState<LanguageFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState<BookMeta | null>(null);
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

  const languageCounts = useMemo(() => {
    let en = 0;
    let km = 0;
    books.forEach((b) => {
      if (b.language === "km") km++;
      else en++;
    });
    return { all: books.length, en, km };
  }, [books]);

  // Reset visible count when filters change
  const [prevFilter, setPrevFilter] = useState({ query, activeTab, category, sortBy, selectedLang });
  if (
    prevFilter.query !== query ||
    prevFilter.activeTab !== activeTab ||
    prevFilter.category !== category ||
    prevFilter.sortBy !== sortBy ||
    prevFilter.selectedLang !== selectedLang
  ) {
    setPrevFilter({ query, activeTab, category, sortBy, selectedLang });
    setVisible(PAGE_SIZE);
  }

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

      if (selectedLang !== "all") {
        const bookLang = b.language || "en";
        if (bookLang !== selectedLang) return false;
      }

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
  }, [books, query, activeTab, category, selectedLang, sortBy]);

  const hasMore = filteredAndSorted.length > visible;

  const handleToggleFavorite = async (book: BookMeta) => {
    const nextFav = !book.favorite;
    setBooks((prev) =>
      prev.map((b) => (b.id === book.id ? { ...b, favorite: nextFav } : b))
    );

    showToast(
      nextFav ? `Added "${book.title}" to favorites` : `Removed "${book.title}" from favorites`,
      nextFav ? "success" : "info"
    );

    await fetch(`/api/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: nextFav }),
    }).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6 pb-28 md:pb-12">
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
      </div>

      {/* Continue Reading Hero Banner (Compact & Mobile-Optimized) */}
      {topContinue ? (
        <div className="group relative overflow-hidden rounded-2xl border border-brand-400/40 bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 p-3 sm:p-4 text-white shadow-lg shadow-brand-500/15">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <BookThumbnailImg
                bookId={topContinue.book.id}
                cover={topContinue.book.cover}
                title={topContinue.book.title}
                className="h-16 w-11 sm:h-18 sm:w-13 shrink-0 rounded-xl shadow-md ring-2 ring-white/30"
              />

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold text-white backdrop-blur-md">
                    <BookOpenIcon size={11} /> Continue Reading
                  </span>
                  <span className="text-[10px] font-bold text-brand-100">
                    {topContinue.progress.progressPercentage}%
                  </span>
                </div>

                <h2 className="line-clamp-1 text-sm sm:text-base font-bold text-white leading-snug">
                  {topContinue.book.title}
                </h2>

                <div className="flex items-center gap-2 text-[11px] text-brand-100">
                  <span className="truncate max-w-[140px] sm:max-w-none">{topContinue.book.author || "Unknown"}</span>
                  <span>•</span>
                  <span className="font-semibold text-white">
                    Page {topContinue.progress.currentPage} / {topContinue.progress.totalPages}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0 justify-end">
              <Link
                href={`/read/${topContinue.book.id}`}
                onMouseEnter={() => prefetchPdf(`/api/books/${topContinue.book.id}/file`)}
                onTouchStart={() => prefetchPdf(`/api/books/${topContinue.book.id}/file`)}
                className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-brand-700 shadow-sm transition-all hover:bg-brand-50 hover:shadow-md active:scale-95"
              >
                <BookOpenIcon size={14} /> Continue
              </Link>
              <Link
                href={`/book/${topContinue.book.id}`}
                className="flex items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/25"
              >
                <SparklesIcon size={14} /> Ask AI
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

      {/* Filter Tabs & Search Toolbar */}
      <div className="space-y-3.5">
        {/* Shelf Tabs & View Mode Segmented Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0 flex-1">
            {(["all", "reading", "unread", "completed", "favorites"] as ShelfTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeTab === t
                    ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Segmented View Switcher (Grid / List) */}
          <div className="flex items-center rounded-xl bg-slate-100/90 p-1 dark:bg-slate-800/90 shrink-0">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                view === "grid"
                  ? "bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
              title="Grid View"
            >
              <GridIcon size={14} />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                view === "list"
                  ? "bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
              title="List View"
            >
              <ListIcon size={14} />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* Search Input & Inline Filter Dropdowns */}
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search books, authors, or topics..."
            />
          </div>

          <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
            <div className="w-full md:w-44">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All Categories</option>
                {categoriesList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="w-full md:w-48">
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                <option value="recent">Recently Added</option>
                <option value="progress">Highest Progress</option>
                <option value="title">Title (A-Z)</option>
                <option value="author">Author Name</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Language Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mr-1">
            Language:
          </span>
          <button
            onClick={() => setSelectedLang("all")}
            className={`rounded-xl px-3 py-1 text-xs font-bold transition-all ${
              selectedLang === "all"
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            All ({languageCounts.all})
          </button>
          <button
            onClick={() => setSelectedLang("en")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition-all ${
              selectedLang === "en"
                ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
                : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <span>🇬🇧</span>
            <span>English ({languageCounts.en})</span>
          </button>
          <button
            onClick={() => setSelectedLang("km")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition-all ${
              selectedLang === "km"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <span>🇰🇭</span>
            <span>ភាសាខ្មែរ / Khmer ({languageCounts.km})</span>
          </button>
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
              ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4"
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
