"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Document, Page } from "react-pdf";
import "@/lib/pdf"; // ensures the worker is configured
import { BookMeta, Bookmark } from "@/lib/types";
import {
  Button,
  buttonClass,
  IconButton,
  SegmentedControl,
  Spinner,
} from "./ui";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BookmarkIcon,
  BookmarkPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  MaximizeIcon,
  MinusIcon,
  PanelLeftIcon,
  PlusIcon,
  ScrollModeIcon,
  SinglePageIcon,
  XIcon,
} from "./ui/icons";

type ReadMode = "paged" | "scroll";
const MODE_KEY = "ebookmine-readmode";

// Let pdf.js pull the PDF over HTTP Range requests and only fetch the bytes it
// needs per page (disableAutoFetch), instead of downloading the whole file into
// memory — this is what keeps very large books from crashing the tab (OOM).
// Module-level constant so react-pdf sees a stable reference (a new object each
// render makes it reload the document repeatedly).
const PDF_OPTIONS = {
  disableAutoFetch: true,
  disableStream: false,
};

export default function Reader({ id }: { id: string }) {
  const { status } = useSession();
  // Owner (signed in) reads from their own Drive and saves progress/bookmarks.
  // Anonymous visitors read the public copy with no persistence.
  const isOwner = status === "authenticated";
  const apiBase = isOwner ? "/api/books" : "/api/public/books";

  const [book, setBook] = useState<BookMeta | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  // scale is relative to fit-to-width: 1 = fit the screen, >1 zooms in.
  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState<ReadMode>("paged");
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [pageInput, setPageInput] = useState("1");
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState(0);
  const savedRef = useRef(false);
  // Wrapper elements for each page in scroll mode (for scroll-into-view + the
  // "which page is centered" observer). Keyed by 1-based page number.
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map());
  // Always holds the latest `page` so effects can read it without re-running.
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  // True while a scroll-mode "jump to current page" is in flight — suppresses
  // the centre-page observer so it doesn't clobber the page to 1 at the top.
  const resumingScroll = useRef(false);

  // Restore the last-used reading mode. Starts "paged" for SSR safety, then
  // syncs to the persisted choice on mount (avoids a hydration mismatch).
  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "paged" || saved === "scroll") setMode(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  // Track the available width of the PDF viewport so pages render fit-to-width
  // (the page never overflows the screen; zoom scales relative to this).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setFitWidth(el.clientWidth);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // 12px of breathing room each side; capped so pages stay readable on desktop.
  const baseWidth = fitWidth > 0 ? Math.min(fitWidth - 24, 1000) : undefined;
  const pageWidth = baseWidth ? baseWidth * scale : undefined;
  // Rough placeholder height for not-yet-rendered scroll pages (A4-ish ratio).
  const estHeight = pageWidth ? Math.round(pageWidth * 1.4) : 900;

  const fileUrl = useMemo(() => `${apiBase}/${id}/file`, [apiBase, id]);
  const downloadUrl = useMemo(
    () =>
      `/api/public/books/${id}/file?download=1` +
      (book ? `&name=${encodeURIComponent(book.title)}` : ""),
    [id, book]
  );

  // Load metadata for this book.
  useEffect(() => {
    if (status === "loading") return;
    fetch(apiBase)
      .then((r) => r.json())
      .then((d) => {
        const found = (d.books as BookMeta[])?.find((b) => b.id === id);
        if (found) {
          setBook(found);
          setBookmarks(found.bookmarks ?? []);
        }
      })
      .catch(() => {});
  }, [id, apiBase, status]);

  // When metadata arrives, resume at last page (once).
  useEffect(() => {
    if (book && !savedRef.current && book.lastPage > 1) {
      setPage(book.lastPage);
      setPageInput(String(book.lastPage));
    }
  }, [book]);

  // Persist reading position (debounced) whenever the page changes.
  // Only the signed-in owner can write; visitors read without saving.
  const persist = useCallback(
    (patch: Partial<BookMeta>) => {
      if (!isOwner) return;
      fetch(`/api/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [id, isOwner]
  );

  useEffect(() => {
    if (!book) return;
    savedRef.current = true;
    const t = setTimeout(() => persist({ lastPage: page }), 800);
    return () => clearTimeout(t);
  }, [page, book, persist]);

  const setCurrent = (p: number) => {
    setPage(p);
    setPageInput(String(p));
  };

  // Navigate to a page — scrolls it into view in scroll mode, swaps the single
  // page in paged mode.
  const goTo = useCallback(
    (p: number) => {
      const clamped = Math.max(1, Math.min(numPages || 1, p));
      setPageInput(String(clamped));
      if (mode === "scroll") {
        pageEls.current.get(clamped)?.scrollIntoView({ behavior: "smooth" });
      } else {
        setPage(clamped);
      }
    },
    [numPages, mode]
  );

  // In scroll mode, track which page sits at the viewport centre and treat it
  // as the current page (drives the counter + progress + saved position).
  useEffect(() => {
    if (mode !== "scroll" || !numPages) return;
    const root = viewportRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        // Ignore observer noise while we're programmatically jumping to the
        // resume page (otherwise the top-of-list page 1 wins and clobbers it).
        if (resumingScroll.current) return;
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) {
          const p = Number(hit.target.getAttribute("data-page"));
          if (p) setCurrent(p);
        }
      },
      { root, rootMargin: "-48% 0px -48% 0px", threshold: 0 }
    );
    pageEls.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [mode, numPages]);

  // Each time we enter scroll mode, jump to the page we were reading. Guard the
  // observer until the jump settles so it can't reset the page to 1.
  useEffect(() => {
    if (mode !== "scroll" || !numPages) return;
    resumingScroll.current = true;
    const target = pageRef.current;
    const raf = requestAnimationFrame(() => {
      pageEls.current.get(target)?.scrollIntoView();
    });
    const t = setTimeout(() => {
      resumingScroll.current = false;
    }, 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [mode, numPages]);

  // Keyboard navigation (both modes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goTo(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, goTo]);

  const addBookmark = () => {
    if (bookmarks.some((b) => b.page === page)) return;
    const next = [
      ...bookmarks,
      { page, label: `Page ${page}`, createdAt: new Date().toISOString() },
    ].sort((a, b) => a.page - b.page);
    setBookmarks(next);
    persist({ bookmarks: next });
  };

  const removeBookmark = (p: number) => {
    const next = bookmarks.filter((b) => b.page !== p);
    setBookmarks(next);
    persist({ bookmarks: next });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const isBookmarked = bookmarks.some((b) => b.page === page);
  const pct = numPages ? Math.round((page / numPages) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950"
    >
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center gap-1.5 border-b border-slate-200/70 bg-white/80 px-3 py-2 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/80">
        <Link href="/" className={buttonClass({ variant: "ghost", size: "sm" })}>
          <ArrowLeftIcon size={17} />
          <span className="hidden sm:inline">Library</span>
        </Link>
        <div className="mx-1 min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {book?.title ?? "Loading…"}
          </p>
          <p className="truncate text-xs text-slate-500">{book?.author}</p>
        </div>

        {/* Reading mode */}
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            {
              value: "paged",
              label: <SinglePageIcon size={17} />,
              title: "Paged — turn one page at a time",
            },
            {
              value: "scroll",
              label: <ScrollModeIcon size={17} />,
              title: "Scroll — continuous vertical scrolling",
            },
          ]}
        />

        {/* Zoom */}
        <div className="hidden items-center rounded-xl border border-slate-200 bg-white/70 sm:flex dark:border-slate-700 dark:bg-slate-800/50">
          <IconButton
            size="icon-sm"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))}
            aria-label="Zoom out"
          >
            <MinusIcon size={17} />
          </IconButton>
          <span className="w-11 text-center text-xs font-medium tabular-nums text-slate-500">
            {Math.round(scale * 100)}%
          </span>
          <IconButton
            size="icon-sm"
            onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))}
            aria-label="Zoom in"
          >
            <PlusIcon size={17} />
          </IconButton>
        </div>

        <IconButton
          size="icon-sm"
          onClick={addBookmark}
          aria-label={isBookmarked ? "Bookmarked" : "Bookmark this page"}
          title={isBookmarked ? "Bookmarked" : "Bookmark this page"}
          className={isBookmarked ? "text-brand-600 dark:text-brand-400" : ""}
        >
          {isBookmarked ? (
            <BookmarkIcon size={18} filled />
          ) : (
            <BookmarkPlusIcon size={18} />
          )}
        </IconButton>
        <IconButton
          size="icon-sm"
          onClick={() => setShowBookmarks((v) => !v)}
          aria-label="Bookmarks"
          title="Bookmarks"
          className={showBookmarks ? "text-brand-600 dark:text-brand-400" : ""}
        >
          <PanelLeftIcon size={18} />
        </IconButton>
        <a
          href={downloadUrl}
          className={buttonClass({ variant: "ghost", size: "icon-sm" })}
          title="Download PDF"
          aria-label="Download PDF"
        >
          <DownloadIcon size={18} />
        </a>
        <IconButton
          size="icon-sm"
          onClick={toggleFullscreen}
          aria-label="Fullscreen"
          title="Fullscreen"
          className="hidden sm:inline-flex"
        >
          <MaximizeIcon size={18} />
        </IconButton>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-1">
        {/* Bookmarks panel */}
        {showBookmarks && (
          <aside className="w-60 shrink-0 animate-fade-in overflow-y-auto border-r border-slate-200 bg-white/80 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <BookmarkIcon
                size={16}
                className="text-brand-600 dark:text-brand-400"
              />
              Bookmarks
            </h3>
            {bookmarks.length === 0 ? (
              <p className="text-sm text-slate-500">No bookmarks yet.</p>
            ) : (
              <ul className="space-y-1">
                {bookmarks.map((b) => (
                  <li
                    key={b.page}
                    className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/30"
                  >
                    <button
                      onClick={() => goTo(b.page)}
                      className="flex items-center gap-2 text-sm"
                    >
                      <BookmarkIcon size={14} filled className="text-brand-500" />
                      {b.label}
                    </button>
                    <button
                      onClick={() => removeBookmark(b.page)}
                      aria-label="Remove bookmark"
                      className="text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    >
                      <XIcon size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        {/* PDF viewport */}
        <div
          ref={viewportRef}
          className="flex min-w-0 flex-1 flex-col items-center overflow-auto py-6"
        >
          {loadError ? (
            <div className="mt-24 flex flex-col items-center text-center text-slate-500">
              <AlertTriangleIcon size={40} className="text-amber-500" />
              <p className="mt-3">Could not load this PDF.</p>
            </div>
          ) : (
            <Document
              file={fileUrl}
              options={PDF_OPTIONS}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                setLoadError(false);
              }}
              onLoadError={() => setLoadError(true)}
              loading={
                <div className="mt-24">
                  <Spinner size="lg" />
                </div>
              }
            >
              {mode === "scroll" && numPages > 0 ? (
                <div className="flex w-full flex-col items-center gap-4">
                  {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                    <ScrollPage
                      key={p}
                      pageNumber={p}
                      width={pageWidth}
                      estHeight={estHeight}
                      rootRef={viewportRef}
                      pageEls={pageEls}
                    />
                  ))}
                </div>
              ) : (
                <Page
                  pageNumber={page}
                  width={pageWidth}
                  scale={pageWidth ? undefined : scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-lg"
                />
              )}
            </Document>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="sticky bottom-0 z-20 flex items-center justify-center gap-2 border-t border-slate-200/70 bg-white/80 px-3 py-2.5 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/80">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeftIcon size={16} />
          Prev
        </Button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(pageInput, 10);
            if (!Number.isNaN(n)) goTo(n);
          }}
          className="flex items-center gap-1.5 text-sm"
        >
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            aria-label="Page number"
            className="w-14 rounded-lg border border-slate-300 bg-white/70 px-2 py-1.5 text-center outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-800/50"
          />
          <span className="text-slate-500">/ {numPages || "…"}</span>
        </form>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => goTo(page + 1)}
          disabled={page >= numPages}
        >
          Next
          <ChevronRightIcon size={16} />
        </Button>
      </div>
    </div>
  );
}

/**
 * One page in continuous-scroll mode. Renders a lightweight placeholder until
 * it nears the viewport, then mounts the real (canvas-backed) react-pdf page —
 * so a 400-page book doesn't rasterise every page up front.
 *
 * Memoized: scrolling updates the parent's `page` state on every tick, which
 * re-renders Reader. Without memo that would re-render every page in the book
 * each tick. Props are all stable (primitives + refs) except width/estHeight,
 * which only change on zoom/resize — so this only re-renders when it must.
 */
const ScrollPage = memo(function ScrollPage({
  pageNumber,
  width,
  estHeight,
  rootRef,
  pageEls,
}: {
  pageNumber: number;
  width?: number;
  estHeight: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  pageEls: React.RefObject<Map<number, HTMLDivElement>>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);
  // Real page aspect ratio (height/width), learned once the page renders. Used
  // for the placeholder height after we unmount it, so collapsing doesn't shift
  // the scroll position.
  const [ratio, setRatio] = useState<number | null>(null);

  // Mount the real (canvas) page only while it's near the viewport, and unmount
  // it again once it's well past — otherwise a long book keeps every rendered
  // canvas in memory and eventually crashes the tab on mobile.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setShow(e.isIntersecting),
      { root: rootRef.current ?? null, rootMargin: "1200px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootRef]);

  // Stable ref callback (identity depends only on pageNumber/pageEls) so the
  // memoized component isn't defeated by a fresh closure each parent render.
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      if (el) pageEls.current.set(pageNumber, el);
      else pageEls.current.delete(pageNumber);
    },
    [pageNumber, pageEls]
  );

  const placeholderHeight = width && ratio ? width * ratio : estHeight;

  return (
    <div
      ref={setRef}
      data-page={pageNumber}
      className="flex w-full justify-center"
      style={show ? undefined : { height: placeholderHeight }}
    >
      {show ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="shadow-lg"
          onLoadSuccess={(pg) => {
            const w = pg.originalWidth || pg.width;
            const h = pg.originalHeight || pg.height;
            if (w && h) setRatio(h / w);
          }}
          loading={
            <div
              className="flex items-center justify-center"
              style={{ height: width && ratio ? width * ratio : estHeight, width: width ?? "100%" }}
            >
              <Spinner />
            </div>
          }
        />
      ) : null}
    </div>
  );
});
