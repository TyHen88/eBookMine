"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMeta } from "@/lib/types";
import BookCard from "./BookCard";
import { SearchInput, Select, Spinner } from "./ui";
import { BookOpenIcon, GridIcon, ListIcon } from "./ui/icons";

const PAGE_SIZE = 48;

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

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Explore eBookMine Library
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Read online eBooks, take notes, highlight passages, and study with AI.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="space-y-3 border-b border-slate-200 pb-4 dark:border-slate-800">
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

          <div className="flex items-center justify-end gap-2">
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
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 p-12 text-center text-xs text-slate-500 dark:border-slate-800">
          No public books found matching your search criteria.
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
    </div>
  );
}
