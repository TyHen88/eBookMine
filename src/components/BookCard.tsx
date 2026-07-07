"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookMeta } from "@/lib/types";
import { buttonClass, Chip } from "./ui";
import {
  BookOpenIcon,
  CheckIcon,
  DownloadIcon,
  StarIcon,
} from "./ui/icons";

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
  index,
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
  index?: number;
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

  // Optional staggered entrance: parents pass a per-card index so a whole grid
  // cascades in. Capped so late cards in a big list don't wait seconds.
  const staggerClass = index === undefined ? "" : "stagger-item";
  const staggerStyle =
    index === undefined
      ? undefined
      : ({ "--i": Math.min(index, 12) } as React.CSSProperties);

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
      className={`absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
        selected
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-white/80 bg-slate-900/30 text-transparent"
      }`}
    >
      <CheckIcon size={13} />
    </div>
  ) : null;

  const FavoriteButton = (
    <button
      onClick={(e) => {
        e.preventDefault();
        onToggleFavorite(book);
      }}
      aria-label={book.favorite ? "Remove favorite" : "Add favorite"}
      title={book.favorite ? "Remove favorite" : "Add favorite"}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 ${
        book.favorite
          ? "text-amber-400"
          : "text-slate-400 hover:text-amber-400"
      }`}
    >
      <StarIcon size={18} filled={book.favorite} />
    </button>
  );

  // Owner (management) reads from the private API; the public library reads the
  // read-only public API. `readOnly` distinguishes the two contexts.
  const apiBase = readOnly ? "/api/public/books" : "/api/books";
  const downloadHref = `${apiBase}/${book.id}/file?download=1&name=${encodeURIComponent(book.title)}`;

  if (view === "list") {
    return (
      <div
        ref={rootRef}
        style={staggerStyle}
        className={`${staggerClass} group relative flex items-center gap-4 rounded-2xl border bg-white/80 p-3 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/10 dark:bg-slate-900/70 ${
          selected
            ? "border-brand-500 ring-2 ring-brand-500"
            : "border-slate-200/80 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700"
        }`}
      >
        {SelectBadge}
        <Link href={`/book/${book.id}`} className="shrink-0 overflow-hidden rounded-lg" {...wrapProps}>
          <Cover
            book={book}
            apiBase={apiBase}
            className="h-20 w-14 transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/book/${book.id}`} {...wrapProps}>
            <h3 className="truncate font-semibold transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
              {book.title}
            </h3>
          </Link>
          {authorLabel(book.author) && (
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {book.author}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {book.category && book.category !== "Other" && (
              <Chip tone="neutral">{book.category}</Chip>
            )}
            {book.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </div>
        {pct > 0 && (
          <span className="hidden shrink-0 text-xs font-medium tabular-nums text-slate-400 sm:inline">
            {pct}%
          </span>
        )}
        {readOnly ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/book/${book.id}`}
              className={buttonClass({ variant: "primary", size: "sm" })}
            >
              View details
            </Link>
            <a
              href={downloadHref}
              className={buttonClass({ variant: "ghost", size: "icon-sm" })}
              title="Download PDF"
              aria-label="Download PDF"
            >
              <DownloadIcon size={18} />
            </a>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            {FavoriteButton}
            <button
              onClick={() => onEdit(book)}
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              Edit
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      style={staggerStyle}
      className={`${staggerClass} group relative flex flex-col overflow-hidden rounded-2xl border bg-white/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-brand-500/15 dark:bg-slate-900/70 ${
        selected
          ? "border-brand-500 ring-2 ring-brand-500"
          : "border-slate-200/80 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700"
      }`}
    >
      {SelectBadge}
      <Link
        href={`/book/${book.id}`}
        className="relative block overflow-hidden"
        {...wrapProps}
      >
        <Cover
          book={book}
          apiBase={apiBase}
          className="aspect-[3/4] w-full transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
        {/* sheen sweep on hover */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        {pct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-slate-900/10 backdrop-blur-sm">
            <div
              className="h-full origin-left animate-bar-grow bg-gradient-to-r from-brand-500 to-brand-400"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </Link>

      {!readOnly && !selectable && (
        <div className="absolute right-2 top-2 rounded-full bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/70">
          {FavoriteButton}
        </div>
      )}

      <div className="flex flex-1 flex-col p-3">
        <Link href={`/book/${book.id}`} {...wrapProps}>
          <h3 className="line-clamp-2 text-sm font-semibold transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
            {book.title}
          </h3>
        </Link>
        {authorLabel(book.author) && (
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {book.author}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {book.category && book.category !== "Other" && (
            <Chip tone="neutral">{book.category}</Chip>
          )}
          {book.tags.slice(0, 2).map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>

        {!readOnly && (
          <button
            onClick={() => onEdit(book)}
            className="mt-2 self-start text-xs font-medium text-slate-400 opacity-0 transition-all duration-200 hover:text-brand-600 group-hover:opacity-100"
          >
            Edit details
          </button>
        )}
        {readOnly && (
          <div className="mt-auto flex items-center gap-2 pt-3">
            <Link
              href={`/read/${book.id}`}
              className={`flex-1 ${buttonClass({ variant: "primary", size: "sm" })}`}
            >
              <BookOpenIcon size={16} />
              Read
            </Link>
            <a
              href={downloadHref}
              className={buttonClass({ variant: "secondary", size: "icon-sm" })}
              title="Download PDF"
              aria-label="Download PDF"
            >
              <DownloadIcon size={16} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Cover({
  book,
  apiBase,
  className,
}: {
  book: BookMeta;
  apiBase: string;
  className?: string;
}) {
  // Prefer a stored cover (from upload extraction); otherwise fall back to
  // Drive's own thumbnail proxy, and finally a title placeholder if neither loads.
  const [failed, setFailed] = useState(false);
  const src = book.cover ?? `${apiBase}/${book.id}/thumb`;

  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={book.title}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`bg-slate-100 object-cover dark:bg-slate-800 ${className ?? ""}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300 p-2 text-center dark:from-brand-900 dark:to-brand-700 ${className ?? ""}`}
    >
      <span className="line-clamp-4 text-xs font-medium text-brand-900 dark:text-brand-100">
        {book.title}
      </span>
    </div>
  );
}
