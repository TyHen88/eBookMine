"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookMeta } from "@/lib/types";
import { prefetchPdf } from "@/lib/pdfCache";
import { buttonClass, Chip } from "./ui";
import {
  BookOpenIcon,
  CheckIcon,
  DownloadIcon,
  StarIcon,
  SparklesIcon,
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
  const isCompleted = pct >= 98;
  const isReading = pct > 0 && !isCompleted;
  const isUnread = pct === 0;
  const [showMenu, setShowMenu] = useState(false);

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
  }, [book, onVisible]);

  const staggerClass = index === undefined ? "" : "stagger-item";
  const staggerStyle =
    index === undefined
      ? undefined
      : ({ "--i": Math.min(index, 12) } as React.CSSProperties);

  const wrapProps = selectable
    ? {
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          onToggleSelect?.(book);
        },
        href: undefined as any,
      }
    : {};

  const apiBase = readOnly ? "/api/public/books" : "/api/books";
  const downloadHref = `${apiBase}/${book.id}/file?download=1&name=${encodeURIComponent(book.title)}`;

  if (view === "list") {
    return (
      <div
        ref={rootRef}
        style={staggerStyle}
        className={`${staggerClass} group relative flex items-center gap-3 sm:gap-4 rounded-2xl border bg-white/90 p-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900/80 ${
          selected
            ? "border-brand-500 ring-2 ring-brand-500"
            : "border-slate-200/80 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700"
        }`}
      >
        <Link href={`/book/${book.id}`} className="shrink-0 overflow-hidden rounded-xl" {...wrapProps}>
          <Cover
            book={book}
            apiBase={apiBase}
            className="h-20 w-14 transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-2">
              <Link href={`/book/${book.id}`} className="min-w-0 flex-1" {...wrapProps}>
                <h3 className="line-clamp-2 text-xs sm:text-sm font-bold text-slate-900 transition-colors group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
                  {book.title}
                </h3>
              </Link>
              {isCompleted && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckIcon size={10} /> Completed
                </span>
              )}
            </div>
            {authorLabel(book.author) && (
              <p className="truncate text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {book.author}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {book.category && book.category !== "Other" && (
                <Chip tone="neutral">{book.category}</Chip>
              )}
              {isReading && (
                <span className="text-[10px] sm:text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                  Page {book.lastPage} / {book.pageCount || "—"} ({pct}%)
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
            <Link
              href={`/read/${book.id}`}
              onMouseEnter={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
              onTouchStart={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
              className={`whitespace-nowrap ${buttonClass({ variant: isReading ? "primary" : "secondary", size: "sm" })}`}
            >
              <BookOpenIcon size={14} />
              {isCompleted ? "Read Again" : isReading ? "Continue" : "Start Reading"}
            </Link>

            {!readOnly && (
              <button
                onClick={() => onToggleFavorite(book)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform ${
                  book.favorite ? "text-amber-400" : "text-slate-400 hover:text-amber-400"
                }`}
              >
                <StarIcon size={16} filled={book.favorite} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      style={staggerStyle}
      className={`${staggerClass} group relative flex flex-col overflow-hidden rounded-2xl border bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-brand-500/10 dark:bg-slate-900/80 ${
        selected
          ? "border-brand-500 ring-2 ring-brand-500"
          : "border-slate-200/80 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700"
      }`}
    >
      <Link
        href={`/book/${book.id}`}
        onMouseEnter={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
        onTouchStart={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
        className="relative block overflow-hidden"
        {...wrapProps}
      >
        <Cover
          book={book}
          apiBase={apiBase}
          className="aspect-[3/4] w-full transition-transform duration-500 ease-out group-hover:scale-[1.05]"
        />

        {/* State Badges */}
        {isCompleted && (
          <div className="absolute left-2 top-2 rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md backdrop-blur-sm flex items-center gap-1">
            <CheckIcon size={11} /> Completed
          </div>
        )}

        {pct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-slate-900/20 backdrop-blur-sm">
            <div
              className="h-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </Link>

      {!readOnly && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggleFavorite(book);
          }}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform hover:scale-110 dark:bg-slate-900/90 ${
            book.favorite ? "text-amber-400" : "text-slate-400 hover:text-amber-400"
          }`}
        >
          <StarIcon size={16} filled={book.favorite} />
        </button>
      )}

      <div className="flex flex-1 flex-col p-2.5 sm:p-3.5">
        <Link href={`/book/${book.id}`} {...wrapProps}>
          <h3 className="line-clamp-2 text-xs font-bold text-slate-900 transition-colors group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400 break-words">
            {book.title}
          </h3>
        </Link>
        {authorLabel(book.author) && (
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {book.author}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-1">
          {book.category && book.category !== "Other" ? (
            <Chip tone="neutral">{book.category}</Chip>
          ) : (
            <span />
          )}

          {isReading && (
            <span className="text-[10px] sm:text-[11px] font-bold tabular-nums text-brand-600 dark:text-brand-400 shrink-0">
              {pct}%
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-2.5">
          <Link
            href={`/read/${book.id}`}
            onMouseEnter={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
            onTouchStart={() => prefetchPdf(`${apiBase}/${book.id}/file`)}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-bold transition-all active:scale-[0.98] ${
              isReading
                ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/20 hover:shadow-md"
                : "border border-slate-200/90 bg-slate-50/80 text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-900/40"
            }`}
          >
            <BookOpenIcon size={13} className="shrink-0" />
            <span className="truncate">
              {isCompleted ? "Read Again" : isReading ? "Continue" : "Read"}
            </span>
          </Link>
        </div>
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
      className={`flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300 p-2 text-center dark:from-brand-950 dark:to-brand-800 ${className ?? ""}`}
    >
      <span className="line-clamp-4 text-xs font-semibold text-brand-900 dark:text-brand-100">
        {book.title}
      </span>
    </div>
  );
}
