"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookMeta } from "@/lib/types";
import BookCard from "./BookCard";
import { SearchInput, SegmentedControl, Select, Spinner } from "./ui";
import { GridIcon, ListIcon, LockIcon, SearchIcon } from "./ui/icons";

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
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!configured) {
    return (
      <main className="mx-auto max-w-2xl animate-fade-in-up px-4 py-24 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <LockIcon size={30} />
        </div>
        <h2 className="mt-5 text-lg font-semibold">
          Public library not set up yet
        </h2>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          The owner hasn&apos;t enabled public access. (Set EBOOKMINE_FOLDER_ID.)
        </p>
      </main>
    );
  }

  const noop = () => {};

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex animate-fade-in-down flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or author…"
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {allCategories.map(([c, n]) => (
            <option key={c} value={c}>
              {c} ({n})
            </option>
          ))}
        </Select>
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: <GridIcon size={17} />, title: "Grid view" },
            { value: "list", label: <ListIcon size={17} />, title: "List view" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex animate-scale-in flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-24 text-center dark:border-slate-700">
          <div className="animate-float text-slate-400">
            <SearchIcon size={44} />
          </div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">
            {books.length === 0
              ? "No books in the library yet."
              : "No books match your search."}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm font-medium text-slate-500">
            {filtered.length} book{filtered.length === 1 ? "" : "s"}
          </div>
          {view === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {shown.map((b, i) => (
                <BookCard
                  key={b.id}
                  book={b}
                  view="grid"
                  index={i}
                  readOnly
                  onToggleFavorite={noop}
                  onEdit={noop}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {shown.map((b, i) => (
                <BookCard
                  key={b.id}
                  book={b}
                  view="list"
                  index={i}
                  readOnly
                  onToggleFavorite={noop}
                  onEdit={noop}
                />
              ))}
            </div>
          )}
          {visible < filtered.length && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
        </>
      )}
    </main>
  );
}
