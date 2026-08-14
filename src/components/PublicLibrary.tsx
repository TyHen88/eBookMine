"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMeta } from "@/lib/types";
import BookCard from "./BookCard";
import { SearchInput, Select, Spinner, SkeletonCard } from "./ui";
import {
  BookOpenIcon,
  GridIcon,
  ListIcon,
  SparklesIcon,
  SearchIcon,
  XIcon,
  TagIcon,
} from "./ui/icons";

const PAGE_SIZE = 12;

export default function PublicLibrary() {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch("/api/public/books")
      .then((r) => r.json())
      .then((d) => setBooks(d.books ?? []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.category && b.category !== "Other") set.add(b.category);
    });
    return Array.from(set).sort();
  }, [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (category && (b.category || "Other") !== category) return false;
      if (q && !`${b.title} ${b.author}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [books, query, category]);

  // Reset visible count when filters change
  const [prevFilter, setPrevFilter] = useState({ query, category });
  if (prevFilter.query !== query || prevFilter.category !== category) {
    setPrevFilter({ query, category });
    setVisible(PAGE_SIZE);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:pl-24 md:pr-10 animate-fade-in">
      {/* Creative Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-brand-200/60 bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-700 p-6 text-white shadow-xl shadow-brand-500/20 dark:border-brand-900/60 sm:p-8">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <SparklesIcon size={14} className="text-amber-300" />
              <span>Public eBook Collection</span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">
              Explore eBookMine Library
            </h1>
            <p className="mt-2 max-w-xl text-xs text-brand-100/90 sm:text-sm">
              Discover curated eBooks, interactive RAG AI study notes, and personal reading progress trackers.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-md ring-1 ring-white/20">
            <span className="text-xl">📚</span>
            <div>
              <span className="block text-sm font-black text-white">{books.length} eBooks</span>
              <span className="block text-[10px] text-brand-100 font-medium">Available in eBookMine</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Glassmorphic Command & Filter Control Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-xl backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-900/80 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Enhanced Search Input */}
          <div className="relative flex-1">
            <SearchIcon
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search books by title, author, or keyword..."
              className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 py-2.5 pl-11 pr-10 text-xs font-medium outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700/80 dark:bg-slate-800/50 dark:text-white dark:focus:border-brand-400"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          {/* Category Dropdown & View Mode Switcher */}
          <div className="flex items-center gap-2">
            <div className="w-44 shrink-0">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full cursor-pointer rounded-2xl border border-slate-200/90 bg-slate-50/50 py-2.5 px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-brand-500 dark:border-slate-700/80 dark:bg-slate-800/50 dark:text-slate-200"
              >
                <option value="">All Categories ({books.length})</option>
                {categoriesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Segmented View Toggle */}
            <div className="flex shrink-0 items-center rounded-2xl border border-slate-200/90 bg-slate-50/50 p-1 dark:border-slate-700/80 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setView("grid")}
                title="Grid View"
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  view === "grid"
                    ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <GridIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                title="List View"
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  view === "list"
                    ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Tag Chips */}
        {categoriesList.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <TagIcon size={12} />
              Filter:
            </span>
            <button
              onClick={() => setCategory("")}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                category === ""
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              All
            </button>
            {categoriesList.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c === category ? "" : c)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                  category === c
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid View vs List View */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 animate-pulse">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} index={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-xs text-slate-500 dark:border-slate-800">
          <BookOpenIcon size={32} className="mx-auto text-slate-400 mb-2" />
          <p className="font-bold text-slate-700 dark:text-slate-300">No matching books found</p>
          <p className="mt-1">Try adjusting your search query or category filter.</p>
        </div>
      ) : (
        <div
          className={
            view === "grid"
              ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              : "space-y-3"
          }
        >
          {filtered.slice(0, visible).map((book, idx) => (
            <BookCard
              key={book.id}
              book={book}
              view={view}
              index={idx}
              readOnly
              onToggleFavorite={() => {}}
              onEdit={() => {}}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!loading && filtered.length > visible && (
        <div className="flex flex-col items-center gap-2 pt-6">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Showing {Math.min(visible, filtered.length)} of {filtered.length} books
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
    </div>
  );
}
