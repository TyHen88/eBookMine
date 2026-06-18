"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookMeta } from "@/lib/types";

function progressPct(book: BookMeta) {
  if (!book.pageCount || book.lastPage <= 1) return 0;
  return Math.min(100, Math.round((book.lastPage / book.pageCount) * 100));
}

const authorLabel = (a: string) =>
  a && a.trim() && a.trim().toLowerCase() !== "unknown" ? a : null;

export default function BookCard({
  book,
  view,
  onToggleFavorite,
  onEdit,
  selectable = false,
  selected = false,
  onToggleSelect,
  onVisible,
  readOnly = false,
}: {
  book: BookMeta;
  view: "grid" | "list";
  onToggleFavorite: (book: BookMeta) => void;
  onEdit: (book: BookMeta) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (book: BookMeta) => void;
  onVisible?: (book: BookMeta) => void;
  readOnly?: boolean;
}) {
  const pct = progressPct(book);

  // Notify the parent the first time this card scrolls into view (used for
  // lazy metadata enrichment — only books the user actually looks at get read).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onVisible || !rootRef.current) return;
    const el = rootRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onVisible(book);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // In selection mode, the whole card toggles selection instead of navigating.
  const wrapProps = selectable
    ? {
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          onToggleSelect?.(book);
        },
        href: undefined as any,
      }
    : {};

  const SelectBadge = selectable ? (
    <div
      className={`absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs ${
        selected
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-white bg-black/30 text-transparent"
      }`}
    >
      ✓
    </div>
  ) : null;

  const FavoriteButton = (
    <button
      onClick={(e) => {
        e.preventDefault();
        onToggleFavorite(book);
      }}
      aria-label="Toggle favorite"
      className="rounded-full p-1.5 text-lg leading-none transition hover:scale-110"
      title={book.favorite ? "Remove favorite" : "Add favorite"}
    >
      {book.favorite ? "⭐" : "☆"}
    </button>
  );

  const downloadHref = `/api/public/books/${book.id}/file?download=1&name=${encodeURIComponent(book.title)}`;
  const DownloadButton = (
    <a
      href={downloadHref}
      onClick={(e) => e.stopPropagation()}
      className="rounded-full bg-black/40 p-1.5 text-sm leading-none text-white transition hover:bg-black/60"
      title="Download PDF"
      aria-label="Download PDF"
    >
      ⬇
    </a>
  );

  if (view === "list") {
    return (
      <div
        ref={rootRef}
        className={`relative flex items-center gap-4 rounded-xl border bg-white p-3 dark:bg-slate-900 ${
          selected
            ? "border-brand-500 ring-2 ring-brand-500"
            : "border-slate-200 dark:border-slate-800"
        }`}
      >
        {SelectBadge}
        <Link href={`/read/${book.id}`} className="shrink-0" {...wrapProps}>
          <Cover book={book} className="h-20 w-14" readOnly={readOnly} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/read/${book.id}`} {...wrapProps}>
            <h3 className="truncate font-semibold hover:text-brand-600">
              {book.title}
            </h3>
          </Link>
          {authorLabel(book.author) && (
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {book.author}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {book.category && book.category !== "Other" && (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {book.category}
              </span>
            )}
            {book.tags.map((t) => (
              <span key={t} className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                {t}
              </span>
            ))}
          </div>
        </div>
        {pct > 0 && (
          <span className="text-xs text-slate-400">{pct}%</span>
        )}
        {readOnly ? (
          <a
            href={downloadHref}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Download PDF"
          >
            ⬇ Download
          </a>
        ) : (
          <>
            {FavoriteButton}
            <button
              onClick={() => onEdit(book)}
              className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Edit
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md dark:bg-slate-900 ${
        selected
          ? "border-brand-500 ring-2 ring-brand-500"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      {SelectBadge}
      <Link href={`/read/${book.id}`} className="relative block" {...wrapProps}>
        <Cover book={book} className="aspect-[3/4] w-full" readOnly={readOnly} />
        {pct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-200/70 dark:bg-slate-700/70">
            <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        )}
      </Link>
      {readOnly ? (
        <div className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100">
          {DownloadButton}
        </div>
      ) : (
        !selectable && <div className="absolute right-1.5 top-1.5">{FavoriteButton}</div>
      )}
      <div className="flex flex-1 flex-col p-3">
        <Link href={`/read/${book.id}`} {...wrapProps}>
          <h3 className="line-clamp-2 text-sm font-semibold hover:text-brand-600">
            {book.title}
          </h3>
        </Link>
        {authorLabel(book.author) && (
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {book.author}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {book.category && book.category !== "Other" && (
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {book.category}
            </span>
          )}
          {book.tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              {t}
            </span>
          ))}
        </div>
        {!readOnly && (
          <button
            onClick={() => onEdit(book)}
            className="mt-2 self-start text-xs text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-brand-600"
          >
            Edit details
          </button>
        )}
      </div>
    </div>
  );
}

function Cover({
  book,
  className,
  readOnly = false,
}: {
  book: BookMeta;
  className?: string;
  readOnly?: boolean;
}) {
  // Prefer a stored cover (from upload extraction); otherwise fall back to
  // Drive's own thumbnail proxy, and finally a title placeholder if neither loads.
  const [failed, setFailed] = useState(false);
  const thumbBase = readOnly ? "/api/public/books" : "/api/books";
  const src = book.cover ?? `${thumbBase}/${book.id}/thumb`;

  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={book.title}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`rounded-md bg-slate-100 object-cover dark:bg-slate-800 ${className ?? ""}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-md bg-gradient-to-br from-brand-100 to-brand-300 p-2 text-center dark:from-brand-900 dark:to-brand-700 ${className ?? ""}`}
    >
      <span className="line-clamp-4 text-xs font-medium text-brand-900 dark:text-brand-100">
        {book.title}
      </span>
    </div>
  );
}
