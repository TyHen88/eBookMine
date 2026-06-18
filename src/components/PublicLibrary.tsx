"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookMeta } from "@/lib/types";
import BookCard from "./BookCard";

const PAGE_SIZE = 48;

export default function PublicLibrary() {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch("/api/public/books")
      .then((r) => r.json())
      .then((d) => {
        setBooks(d.books ?? []);
        setConfigured(d.configured !== false);
      })
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  const allCategories = useMemo(() => {
    const counts = new Map<string, number>();
    books.forEach((b) => {
      const c = b.category || "Other";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (category && (b.category || "Other") !== category) return false;
      if (q && !`${b.title} ${b.author}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [books, query, category]);

  useEffect(() => setVisible(PAGE_SIZE), [query, category, view]);

  const shown = filtered.slice(0, visible);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting)
          setVisible((v) => Math.min(filtered.length, v + PAGE_SIZE));
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [filtered.length, loading]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!configured) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="text-5xl">🔒</div>
        <h2 className="mt-4 text-lg font-semibold">Public library not set up yet</h2>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          The owner hasn&apos;t enabled public access. (Set OWNER_REFRESH_TOKEN.)
        </p>
      </main>
    );
  }

  const noop = () => {};

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or author…"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 pl-10 dark:border-slate-700 dark:bg-slate-900"
          />
          <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
            🔍
          </span>
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">All categories</option>
          {allCategories.map(([c, n]) => (
            <option key={c} value={c}>
              {c} ({n})
            </option>
          ))}
        </select>

        <div className="flex overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-2 text-sm ${view === "grid" ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          >
            ▦
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-2 text-sm ${view === "list" ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          >
            ☰
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-500">
          {books.length === 0 ? "No books in the library yet." : "No matches."}
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm text-slate-500">
            {filtered.length} book{filtered.length === 1 ? "" : "s"}
          </div>
          {view === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {shown.map((b) => (
                <BookCard key={b.id} book={b} view="grid" readOnly onToggleFavorite={noop} onEdit={noop} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {shown.map((b) => (
                <BookCard key={b.id} book={b} view="list" readOnly onToggleFavorite={noop} onEdit={noop} />
              ))}
            </div>
          )}
          {visible < filtered.length && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          )}
        </>
      )}
    </main>
  );
}
