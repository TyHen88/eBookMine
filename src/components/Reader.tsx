"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Document, Page } from "react-pdf";
import "@/lib/pdf"; // ensures the worker is configured
import { BookMeta, Bookmark } from "@/lib/types";

export default function Reader({ id }: { id: string }) {
  const { status } = useSession();
  // Owner (signed in) reads from their own Drive and saves progress/bookmarks.
  // Anonymous visitors read the public copy with no persistence.
  const isOwner = status === "authenticated";
  const apiBase = isOwner ? "/api/books" : "/api/public/books";

  const [book, setBook] = useState<BookMeta | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [pageInput, setPageInput] = useState("1");
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(false);

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

  const goTo = (p: number) => {
    const clamped = Math.max(1, Math.min(numPages || 1, p));
    setPage(clamped);
    setPageInput(String(clamped));
  };

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goTo(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const addBookmark = () => {
    if (bookmarks.some((b) => b.page === page)) return;
    const next = [
      ...bookmarks,
      {
        page,
        label: `Page ${page}`,
        createdAt: new Date().toISOString(),
      },
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
    <div ref={containerRef} className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <Link
          href="/"
          className="rounded-lg px-2 py-1 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          ← Library
        </Link>
        <div className="mx-2 min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{book?.title ?? "Loading…"}</p>
          <p className="truncate text-xs text-slate-500">{book?.author}</p>
        </div>

        {/* Zoom */}
        <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))} className="btnIcon">
          −
        </button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))} className="btnIcon">
          +
        </button>

        <button
          onClick={addBookmark}
          className="btnIcon"
          title={isBookmarked ? "Bookmarked" : "Bookmark this page"}
        >
          {isBookmarked ? "🔖" : "➕🔖"}
        </button>
        <button onClick={() => setShowBookmarks((v) => !v)} className="btnIcon" title="Bookmarks">
          ☰
        </button>
        <a href={downloadUrl} className="btnIcon" title="Download PDF" aria-label="Download PDF">
          ⬇
        </a>
        <button onClick={toggleFullscreen} className="btnIcon" title="Fullscreen">
          ⛶
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-1">
        {/* Bookmarks panel */}
        {showBookmarks && (
          <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-semibold">Bookmarks</h3>
            {bookmarks.length === 0 ? (
              <p className="text-sm text-slate-500">No bookmarks yet.</p>
            ) : (
              <ul className="space-y-1">
                {bookmarks.map((b) => (
                  <li key={b.page} className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <button onClick={() => goTo(b.page)} className="text-sm">
                      🔖 {b.label}
                    </button>
                    <button
                      onClick={() => removeBookmark(b.page)}
                      className="text-xs text-slate-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        {/* PDF viewport */}
        <div className="flex flex-1 flex-col items-center overflow-auto py-6">
          {loadError ? (
            <div className="mt-20 text-center text-slate-500">
              <p className="text-3xl">⚠️</p>
              <p className="mt-2">Could not load this PDF.</p>
            </div>
          ) : (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                setLoadError(false);
              }}
              onLoadError={() => setLoadError(true)}
              loading={
                <div className="mt-20 h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              }
            >
              <Page
                pageNumber={page}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-lg"
              />
            </Document>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="sticky bottom-0 z-20 flex items-center justify-center gap-3 border-t border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <button onClick={() => goTo(page - 1)} disabled={page <= 1} className="navBtn">
          ‹ Prev
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(pageInput, 10);
            if (!Number.isNaN(n)) goTo(n);
          }}
          className="flex items-center gap-1 text-sm"
        >
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="w-14 rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-center dark:border-slate-700"
          />
          <span className="text-slate-500">/ {numPages || "…"}</span>
        </form>
        <button onClick={() => goTo(page + 1)} disabled={page >= numPages} className="navBtn">
          Next ›
        </button>
      </div>

      <style jsx>{`
        .btnIcon {
          border-radius: 0.5rem;
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
        }
        .btnIcon:hover {
          background: rgba(148, 163, 184, 0.2);
        }
        .navBtn {
          border-radius: 0.5rem;
          padding: 0.375rem 0.875rem;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .navBtn:hover:not(:disabled) {
          background: rgba(148, 163, 184, 0.2);
        }
        .navBtn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
