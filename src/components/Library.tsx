"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookMeta } from "@/lib/types";
import BookCard from "./BookCard";
import UploadZone from "./UploadZone";
import BookDetailModal from "./BookDetailModal";
import ImportFromDrive from "./ImportFromDrive";
import { extractPdfInfo } from "@/lib/pdf";
import { Button, SearchInput, SegmentedControl, Select, Spinner } from "./ui";
import {
  GridIcon,
  ListIcon,
  LogoIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
} from "./ui/icons";

const PAGE_SIZE = 48;

export default function Library() {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState<BookMeta | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch("/api/books")
      .then((r) => r.json())
      .then((d) => setBooks(d.books ?? []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [books]);

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
      if (favoritesOnly && !b.favorite) return false;
      if (category && (b.category || "Other") !== category) return false;
      if (activeTag && !b.tags.includes(activeTag)) return false;
      if (q && !`${b.title} ${b.author}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [books, query, activeTag, favoritesOnly, category]);

  // Reset the visible window whenever the filtered set changes.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, activeTag, favoritesOnly, category, view]);

  const shown = filtered.slice(0, visible);

  // Infinite scroll: load another page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible((v) => Math.min(filtered.length, v + PAGE_SIZE));
        }
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [filtered.length, loading]);

  const patchBook = async (id: string, patch: Partial<BookMeta>) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
    await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  // Lazy metadata enrichment: when a book scrolls into view and is still missing
  // its author / page count, read the PDF's embedded metadata once and save it.
  // Concurrency-limited so scrolling a big library doesn't hammer Drive.
  const enrichSeen = useRef<Set<string>>(new Set());
  const enrichQueue = useRef<BookMeta[]>([]);
  const enrichActive = useRef(0);
  const MAX_ENRICH = 2;

  const pumpEnrich = () => {
    while (enrichActive.current < MAX_ENRICH && enrichQueue.current.length) {
      const book = enrichQueue.current.shift()!;
      enrichActive.current++;
      (async () => {
        try {
          const res = await fetch(`/api/books/${book.id}/file`);
          if (res.ok) {
            const blob = await res.blob();
            const file = new File([blob], book.fileName, {
              type: "application/pdf",
            });
            const info = await extractPdfInfo(file);
            const patch: Partial<BookMeta> = {};
            if (info.pageCount && !book.pageCount) patch.pageCount = info.pageCount;
            if (
              info.author &&
              (!book.author || book.author.toLowerCase() === "unknown")
            )
              patch.author = info.author;
            if (Object.keys(patch).length) await patchBook(book.id, patch);
          }
        } catch {
          /* best-effort */
        } finally {
          enrichActive.current--;
          pumpEnrich();
        }
      })();
    }
  };

  const handleVisible = (book: BookMeta) => {
    if (enrichSeen.current.has(book.id)) return;
    const needs =
      book.pageCount === 0 ||
      !book.author ||
      book.author.toLowerCase() === "unknown";
    if (!needs) return;
    enrichSeen.current.add(book.id);
    enrichQueue.current.push(book);
    pumpEnrich();
  };

  const deleteBook = async (id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/books/${id}`, { method: "DELETE" });
  };

  // Import existing Drive PDFs picked via the Google Picker.
  const importFromDrive = async (ids: string[]) => {
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    const { imported } = (await res.json()) as { imported: BookMeta[] };
    if (!imported?.length) return;

    setBooks((prev) => {
      const existing = new Set(prev.map((b) => b.id));
      const fresh = imported.filter((b) => !existing.has(b.id));
      return [...fresh, ...prev];
    });

    // Enrich each imported book with a cover + page count (best-effort).
    for (const book of imported) {
      try {
        const blob = await (await fetch(`/api/books/${book.id}/file`)).blob();
        const file = new File([blob], book.fileName, { type: "application/pdf" });
        const info = await extractPdfInfo(file);
        const patch: Partial<BookMeta> = {
          cover: info.cover,
          pageCount: info.pageCount,
        };
        if (info.title && book.title === book.fileName.replace(/\.pdf$/i, ""))
          patch.title = info.title;
        if (info.author && book.author === "Unknown") patch.author = info.author;
        await patchBook(book.id, patch);
      } catch {
        /* enrichment is optional */
      }
    }
  };

  const continueReading = books
    .filter((b) => b.lastPage > 1 && b.pageCount > 0 && b.lastPage < b.pageCount)
    .slice(0, 6);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Toolbar */}
      <div className="mb-6 flex animate-fade-in-down flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or author…"
        />

        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          title="Filter by category"
        >
          <option value="">All categories</option>
          {allCategories.map(([c, n]) => (
            <option key={c} value={c}>
              {c} ({n})
            </option>
          ))}
        </Select>

        <Button
          variant={favoritesOnly ? "primary" : "secondary"}
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          <StarIcon size={16} filled={favoritesOnly} />
          Favorites
        </Button>

        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: <GridIcon size={17} />, title: "Grid view" },
            { value: "list", label: <ListIcon size={17} />, title: "List view" },
          ]}
        />

        <ImportFromDrive onImported={importFromDrive} />

        <Button onClick={() => setShowUpload((v) => !v)}>
          <PlusIcon size={17} />
          Add books
        </Button>
      </div>

      {showUpload && (
        <div className="mb-6 animate-scale-in">
          <UploadZone
            onUploaded={(book) =>
              setBooks((prev) => [book, ...prev.filter((b) => b.id !== book.id)])
            }
          />
        </div>
      )}

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`rounded-full px-3 py-1 text-sm transition-all duration-200 active:scale-95 ${
              activeTag === null
                ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30"
                : "bg-slate-200 hover:bg-brand-100 dark:bg-slate-800 dark:hover:bg-brand-900/50"
            }`}
          >
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(t === activeTag ? null : t)}
              className={`rounded-full px-3 py-1 text-sm transition-all duration-200 active:scale-95 ${
                activeTag === t
                  ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30"
                  : "bg-slate-200 hover:bg-brand-100 dark:bg-slate-800 dark:hover:bg-brand-900/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Continue reading shelf */}
      {!query && !activeTag && !favoritesOnly && continueReading.length > 0 && (
        <section className="mb-8 animate-fade-in-up">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <span className="inline-block h-4 w-1 rounded-full bg-gradient-to-b from-brand-500 to-brand-400" />
            Continue reading
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {continueReading.map((b, i) => (
              <BookCard
                key={b.id}
                book={b}
                view="grid"
                index={i}
                onToggleFavorite={(bk) => patchBook(bk.id, { favorite: !bk.favorite })}
                onEdit={setEditing}
              />
            ))}
          </div>
        </section>
      )}

      {/* Main grid */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasBooks={books.length > 0} onAdd={() => setShowUpload(true)} />
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
                  onToggleFavorite={(bk) => patchBook(bk.id, { favorite: !bk.favorite })}
                  onEdit={setEditing}
                  onVisible={handleVisible}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {shown.map((b, i) => (
                <BookCard
                  key={b.id}
                  book={b}
                  view="list"
                  index={i}
                  onToggleFavorite={(bk) => patchBook(bk.id, { favorite: !bk.favorite })}
                  onEdit={setEditing}
                  onVisible={handleVisible}
                />
              ))}
            </div>
          )}

          {/* Infinite-scroll sentinel */}
          {visible < filtered.length && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
        </>
      )}

      {editing && (
        <BookDetailModal
          book={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => patchBook(editing.id, patch)}
          onDelete={async () => {
            await deleteBook(editing.id);
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

function EmptyState({
  hasBooks,
  onAdd,
}: {
  hasBooks: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex animate-scale-in flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-24 text-center dark:border-slate-700">
      <div className="animate-float text-brand-500/70">
        {hasBooks ? <SearchIcon size={44} /> : <LogoIcon size={44} />}
      </div>
      <h2 className="mt-4 text-lg font-semibold">
        {hasBooks ? "No books match your filters" : "Your library is empty"}
      </h2>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        {hasBooks
          ? "Try clearing the search or tag filters."
          : "Upload your first PDF to get started."}
      </p>
      {!hasBooks && (
        <Button onClick={onAdd} className="mt-5">
          <PlusIcon size={17} />
          Add books
        </Button>
      )}
    </div>
  );
}
