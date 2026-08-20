"use client";

import React, { memo, useRef, useEffect } from "react";
import { Page } from "react-pdf";
import { HighlightData, BookmarkData, NoteData } from "@/lib/readingService";
import { Spinner } from "@/components/ui";

function isAbortError(err: any): boolean {
  if (!err) return false;
  if (
    err.name === "AbortException" ||
    err.name === "AbortError" ||
    err.name === "RenderingCancelledException"
  ) {
    return true;
  }
  const str = typeof err === "string" ? err : err.message || String(err);
  return (
    str.includes("cancelled") ||
    str.includes("AbortException") ||
    str.includes("aborted") ||
    str.includes("TextLayer task cancelled") ||
    str.includes("RenderingCancelledException") ||
    str.includes("Canvas task cancelled")
  );
}

interface VirtualPageProps {
  pageNumber: number;
  width?: number;
  scale?: number;
  dpr: number;
  isActive: boolean;
  aspectRatio?: number;
  highlights?: HighlightData[];
  bookmarks?: BookmarkData[];
  notes?: NoteData[];
  onGetTextSuccess?: (pageNumber: number, hasText: boolean) => void;
  onPageRenderSuccess?: (pageNumber: number) => void;
  onPageElementRegister?: (pageNumber: number, el: HTMLDivElement | null) => void;
}

function areEqual(prev: VirtualPageProps, next: VirtualPageProps): boolean {
  if (
    prev.pageNumber !== next.pageNumber ||
    prev.width !== next.width ||
    prev.scale !== next.scale ||
    prev.dpr !== next.dpr ||
    prev.isActive !== next.isActive ||
    prev.aspectRatio !== next.aspectRatio ||
    prev.onPageElementRegister !== next.onPageElementRegister
  ) {
    return false;
  }

  // Fast length check for bookmarks
  const prevBm = prev.bookmarks || [];
  const nextBm = next.bookmarks || [];
  if (prevBm.length !== nextBm.length) return false;
  for (let i = 0; i < prevBm.length; i++) {
    if (prevBm[i].id !== nextBm[i].id || prevBm[i].page !== nextBm[i].page) return false;
  }

  // Fast length check for highlights
  const prevHl = prev.highlights || [];
  const nextHl = next.highlights || [];
  if (prevHl.length !== nextHl.length) return false;
  for (let i = 0; i < prevHl.length; i++) {
    if (
      prevHl[i].id !== nextHl[i].id ||
      prevHl[i].color !== nextHl[i].color ||
      prevHl[i].selectedText !== nextHl[i].selectedText
    ) {
      return false;
    }
  }

  // Fast length check for notes
  const prevNotes = prev.notes || [];
  const nextNotes = next.notes || [];
  if (prevNotes.length !== nextNotes.length) return false;
  for (let i = 0; i < prevNotes.length; i++) {
    if (
      prevNotes[i].id !== nextNotes[i].id ||
      prevNotes[i].content !== nextNotes[i].content ||
      prevNotes[i].updatedAt !== nextNotes[i].updatedAt
    ) {
      return false;
    }
  }

  return true;
}

const HIGHLIGHT_COLOR_MAP: Record<string, string> = {
  yellow: "rgba(251, 191, 36, 0.45)",
  green: "rgba(52, 211, 153, 0.45)",
  blue: "rgba(56, 189, 248, 0.45)",
  purple: "rgba(192, 132, 252, 0.45)",
  pink: "rgba(244, 114, 182, 0.45)",
};

const VirtualPage = memo(function VirtualPage({
  pageNumber,
  width,
  scale,
  dpr,
  isActive,
  aspectRatio = 0.707, // Standard A4 / US Letter portrait ratio ~1 / sqrt(2)
  highlights = [],
  bookmarks = [],
  notes = [],
  onGetTextSuccess,
  onPageRenderSuccess,
  onPageElementRegister,
}: VirtualPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const applyHighlightsToDom = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const textLayer = container.querySelector(".react-pdf__Page__textContent, .textLayer");
    if (!textLayer) return;

    const spans = Array.from(textLayer.querySelectorAll("span"));
    if (spans.length === 0) return;

    // Reset previous highlights on spans
    spans.forEach((span) => {
      span.style.removeProperty("background");
      span.style.removeProperty("border-radius");
      span.removeAttribute("data-highlighted");
    });

    if (highlights.length === 0) return;

    for (const hl of highlights) {
      const cleanHl = (hl.selectedText || "").trim().toLowerCase();
      if (!cleanHl) continue;

      const hlWords = cleanHl.split(/\s+/).filter((w) => w.length > 0);
      if (hlWords.length === 0) continue;

      const bg = HIGHLIGHT_COLOR_MAP[hl.color] || HIGHLIGHT_COLOR_MAP.yellow;

      for (const span of spans) {
        const spanText = (span.textContent || "").trim().toLowerCase();
        if (!spanText) continue;

        const isExactOrSubstring = cleanHl.includes(spanText) || spanText.includes(cleanHl);
        const isWordMatch = hlWords.some((w) => w.length >= 2 && spanText.includes(w));

        if (isExactOrSubstring || isWordMatch) {
          span.style.background = bg;
          span.style.borderRadius = "3px";
          span.setAttribute("data-highlighted", "true");
        }
      }
    }
  }, [highlights]);

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(applyHighlightsToDom, 60);
      return () => clearTimeout(timer);
    }
  }, [isActive, highlights, applyHighlightsToDom]);

  useEffect(() => {
    if (onPageElementRegister) {
      onPageElementRegister(pageNumber, containerRef.current);
    }
    return () => {
      if (onPageElementRegister) {
        onPageElementRegister(pageNumber, null);
      }
    };
  }, [pageNumber, onPageElementRegister]);

  const estimatedHeight = width ? Math.round(width / aspectRatio) : 800;

  return (
    <div
      ref={containerRef}
      data-page-number={pageNumber}
      style={{
        width: width ? `${width}px` : "100%",
        minHeight: `${estimatedHeight}px`,
        containIntrinsicSize: width ? `${width}px ${estimatedHeight}px` : `100% 800px`,
      }}
      className="relative flex flex-col items-center justify-center my-3 rounded-lg bg-white shadow-md dark:bg-slate-900 overflow-hidden"
    >
      {/* Top Page Badges: Notes & Bookmarks */}
      <div className="absolute top-0 right-4 z-10 flex items-center gap-1 pointer-events-none">
        {notes.length > 0 && (
          <div
            className="flex h-7 items-center gap-1 rounded-b-md bg-brand-600 px-2 text-[10px] font-bold text-white shadow-md"
            title={`${notes.length} note(s) attached to Page ${pageNumber}`}
          >
            <span>📝</span>
            <span>{notes.length}</span>
          </div>
        )}

        {bookmarks.length > 0 && (
          <div
            className="flex h-7 items-center gap-1 rounded-b-md bg-amber-500 px-2 text-[10px] font-bold text-white shadow-md"
            title={bookmarks.map((b) => b.title).join(", ")}
          >
            <span>🔖</span>
            <span>P.{pageNumber}</span>
          </div>
        )}
      </div>

      {isActive ? (
        <div className="relative w-full flex justify-center">
          <Page
            pageNumber={pageNumber}
            width={width}
            scale={width ? undefined : scale}
            devicePixelRatio={dpr}
            renderTextLayer={true}
            renderAnnotationLayer={false}
            onGetTextSuccess={(text) => {
              onGetTextSuccess?.(pageNumber, text.items.length > 0);
              setTimeout(applyHighlightsToDom, 30);
            }}
            onGetTextError={(err) => {
              if (isAbortError(err)) return;
            }}
            onRenderSuccess={() => {
              onPageRenderSuccess?.(pageNumber);
              setTimeout(applyHighlightsToDom, 30);
            }}
            loading={
              <div
                style={{ height: `${estimatedHeight}px` }}
                className="flex flex-col items-center justify-center w-full p-8 space-y-4 bg-white dark:bg-slate-900 animate-pulse"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
                  <Spinner size="sm" />
                  <span>Loading Page {pageNumber}...</span>
                </div>
                <div className="w-3/4 h-3.5 rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="w-full h-3.5 rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="w-5/6 h-3.5 rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
            }
            onRenderError={(err) => {
              if (isAbortError(err)) return;
              console.error(`Page ${pageNumber} render error:`, err);
            }}
            onRenderTextLayerError={(err) => {
              if (isAbortError(err)) return;
            }}
          />
        </div>
      ) : (
        /* Lightweight placeholder when scrolled out of view */
        <div
          style={{ height: `${estimatedHeight}px` }}
          className="flex flex-col items-center justify-center w-full p-8 space-y-4 bg-slate-50/60 dark:bg-slate-900/60 select-none"
        >
          <div className="flex items-center justify-center h-8 w-16 rounded-full bg-slate-200/70 dark:bg-slate-800/80 text-xs font-bold text-slate-500 dark:text-slate-400 shadow-inner">
            P. {pageNumber}
          </div>
          <div className="w-2/3 h-3 rounded-full bg-slate-200/40 dark:bg-slate-800/40" />
          <div className="w-4/5 h-3 rounded-full bg-slate-200/40 dark:bg-slate-800/40" />
          <div className="w-1/2 h-3 rounded-full bg-slate-200/40 dark:bg-slate-800/40" />
        </div>
      )}
    </div>
  );
}, areEqual);

export default VirtualPage;
