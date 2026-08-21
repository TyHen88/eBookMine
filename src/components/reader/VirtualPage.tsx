"use client";

import React, { memo, useRef, useEffect } from "react";
import { Page } from "react-pdf";
import { HighlightData, BookmarkData, NoteData } from "@/lib/readingService";
import { Spinner } from "@/components/ui";
import { SparklesIcon, XIcon } from "@/components/ui/icons";

export interface SelectedAreaBox {
  page: number;
  relX: number;
  relY: number;
  relW: number;
  relH: number;
  text: string;
  isAiOpened?: boolean;
}

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
  selectedArea?: SelectedAreaBox | null;
  onAskAiArea?: (text: string, page: number) => void;
  onDismissArea?: () => void;
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

  // Check selectedArea change on this page
  const prevArea = prev.selectedArea;
  const nextArea = next.selectedArea;
  const areaWasOnThisPage = prevArea?.page === prev.pageNumber;
  const areaIsOnThisPage = nextArea?.page === next.pageNumber;
  if (areaWasOnThisPage !== areaIsOnThisPage) return false;
  if (areaIsOnThisPage && prevArea && nextArea) {
    if (
      prevArea.relX !== nextArea.relX ||
      prevArea.relY !== nextArea.relY ||
      prevArea.relW !== nextArea.relW ||
      prevArea.relH !== nextArea.relH ||
      prevArea.isAiOpened !== nextArea.isAiOpened ||
      prevArea.text !== nextArea.text
    ) {
      return false;
    }
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
  selectedArea,
  onAskAiArea,
  onDismissArea,
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

    const rawSpans = Array.from(textLayer.querySelectorAll("span"));
    // Filter only top-level text layer spans (excluding internal mark elements)
    const spans = rawSpans.filter((s) => s.parentElement === textLayer || s.getAttribute("role") === "presentation");
    const targetSpans = spans.length > 0 ? spans : rawSpans;
    if (targetSpans.length === 0) return;

    // 1. Reset previous highlights cleanly
    targetSpans.forEach((span) => {
      span.style.removeProperty("background");
      span.style.removeProperty("border-radius");
      if (span.querySelector("mark.ebookmine-highlight")) {
        span.textContent = span.textContent;
      }
      span.removeAttribute("data-highlighted");
    });

    if (highlights.length === 0) return;

    // 2. Build continuous page text stream and map char offsets to (spanIndex, offsetInSpan)
    interface CharLocation {
      spanIndex: number;
      offset: number;
    }

    let fullPageText = "";
    const indexMap: (CharLocation | null)[] = [];

    for (let sIdx = 0; sIdx < targetSpans.length; sIdx++) {
      const span = targetSpans[sIdx];
      const text = span.textContent || "";
      if (!text) continue;

      if (
        fullPageText.length > 0 &&
        !/\s/.test(fullPageText[fullPageText.length - 1]) &&
        !/\s/.test(text[0])
      ) {
        fullPageText += " ";
        indexMap.push(null);
      }

      for (let cIdx = 0; cIdx < text.length; cIdx++) {
        fullPageText += text[cIdx];
        indexMap.push({ spanIndex: sIdx, offset: cIdx });
      }
    }

    if (!fullPageText) return;

    // 3. Find exact occurrences of highlighted texts
    interface SpanRange {
      start: number;
      end: number;
      bg: string;
    }

    const spanRangesMap = new Map<number, SpanRange[]>();

    for (const hl of highlights) {
      const target = (hl.selectedText || "").trim();
      if (!target || target.length < 1) continue;

      const bg = HIGHLIGHT_COLOR_MAP[hl.color] || HIGHLIGHT_COLOR_MAP.yellow;

      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = escaped.replace(/\s+/g, "\\s+");

      let matchRegex: RegExp | null = null;
      try {
        matchRegex = new RegExp(pattern, "gi");
      } catch {
        matchRegex = null;
      }

      const matchIndices: Array<{ start: number; length: number }> = [];

      if (matchRegex) {
        let match: RegExpExecArray | null;
        while ((match = matchRegex.exec(fullPageText)) !== null) {
          matchIndices.push({ start: match.index, length: match[0].length });
          if (match[0].length === 0) break;
        }
      }

      if (matchIndices.length === 0) {
        const lowerFull = fullPageText.toLowerCase();
        const lowerTarget = target.toLowerCase();
        let idx = lowerFull.indexOf(lowerTarget);
        while (idx !== -1) {
          matchIndices.push({ start: idx, length: lowerTarget.length });
          idx = lowerFull.indexOf(lowerTarget, idx + lowerTarget.length);
        }
      }

      for (const { start, length } of matchIndices) {
        const end = start + length;
        let currentSpanIdx = -1;
        let rangeStartInSpan = -1;
        let rangeEndInSpan = -1;

        for (let k = start; k < end && k < indexMap.length; k++) {
          const loc = indexMap[k];
          if (!loc) {
            if (currentSpanIdx !== -1 && rangeStartInSpan !== -1) {
              const ranges = spanRangesMap.get(currentSpanIdx) || [];
              ranges.push({ start: rangeStartInSpan, end: rangeEndInSpan, bg });
              spanRangesMap.set(currentSpanIdx, ranges);
              currentSpanIdx = -1;
              rangeStartInSpan = -1;
              rangeEndInSpan = -1;
            }
            continue;
          }

          if (loc.spanIndex !== currentSpanIdx) {
            if (currentSpanIdx !== -1 && rangeStartInSpan !== -1) {
              const ranges = spanRangesMap.get(currentSpanIdx) || [];
              ranges.push({ start: rangeStartInSpan, end: rangeEndInSpan, bg });
              spanRangesMap.set(currentSpanIdx, ranges);
            }
            currentSpanIdx = loc.spanIndex;
            rangeStartInSpan = loc.offset;
            rangeEndInSpan = loc.offset + 1;
          } else {
            rangeEndInSpan = loc.offset + 1;
          }
        }

        if (currentSpanIdx !== -1 && rangeStartInSpan !== -1) {
          const ranges = spanRangesMap.get(currentSpanIdx) || [];
          ranges.push({ start: rangeStartInSpan, end: rangeEndInSpan, bg });
          spanRangesMap.set(currentSpanIdx, ranges);
        }
      }
    }

    // 4. Apply exact highlights to DOM spans using <mark>
    spanRangesMap.forEach((ranges, sIdx) => {
      const span = targetSpans[sIdx];
      if (!span) return;

      const origText = span.textContent || "";
      if (!origText) return;

      ranges.sort((a, b) => a.start - b.start);
      const mergedRanges: SpanRange[] = [];
      for (const r of ranges) {
        if (mergedRanges.length === 0) {
          mergedRanges.push({ ...r });
        } else {
          const last = mergedRanges[mergedRanges.length - 1];
          if (r.start < last.end) {
            if (r.end > last.end) {
              last.end = r.end;
            }
          } else {
            mergedRanges.push({ ...r });
          }
        }
      }

      const fragment = document.createDocumentFragment();
      let lastIdx = 0;

      for (const r of mergedRanges) {
        const start = Math.max(0, Math.min(r.start, origText.length));
        const end = Math.max(start, Math.min(r.end, origText.length));

        if (start > lastIdx) {
          fragment.appendChild(document.createTextNode(origText.slice(lastIdx, start)));
        }

        if (end > start) {
          const mark = document.createElement("mark");
          mark.className = "ebookmine-highlight";
          mark.style.backgroundColor = r.bg;
          mark.style.color = "inherit";
          mark.style.borderRadius = "2px";
          mark.style.padding = "0";
          mark.style.margin = "0";
          mark.textContent = origText.slice(start, end);
          fragment.appendChild(mark);
        }

        lastIdx = end;
      }

      if (lastIdx < origText.length) {
        fragment.appendChild(document.createTextNode(origText.slice(lastIdx)));
      }

      span.replaceChildren(fragment);
      span.setAttribute("data-highlighted", "true");
    });
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

      {/* Page-Locked Selected Area Box Overlay & Mini Ask AI HUD */}
      {selectedArea && selectedArea.page === pageNumber && (
        <>
          <div
            style={{
              position: "absolute",
              left: `${selectedArea.relX}%`,
              top: `${selectedArea.relY}%`,
              width: `${selectedArea.relW}%`,
              height: `${selectedArea.relH}%`,
            }}
            className="z-30 border-2 border-brand-500 bg-brand-500/15 shadow-2xl ring-2 ring-brand-400/40 rounded-lg animate-scaleUp pointer-events-none"
          >
            {/* Touch-Friendly Corner Handles */}
            <div className="absolute -left-2 -top-2 h-4 w-4 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />
            <div className="absolute -right-2 -top-2 h-4 w-4 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />
            <div className="absolute -bottom-2 -left-2 h-4 w-4 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />
            <div className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />

            {/* Dimensions Badge */}
            <div className="absolute -top-7 left-0 inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
              <span>Selected Area</span>
            </div>

            {/* Close button on box when AI is already open */}
            {selectedArea.isAiOpened && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissArea?.();
                }}
                className="pointer-events-auto absolute -top-3.5 -right-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-2 ring-white hover:bg-red-600 transition active:scale-95"
                title="Remove selection box"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          {/* Mini Ask AI HUD (only before clicking Ask AI) */}
          {!selectedArea.isAiOpened && (
            <div
              style={{
                position: "absolute",
                left: `${selectedArea.relX + selectedArea.relW / 2}%`,
                top: selectedArea.relY < 12 ? `${selectedArea.relY + selectedArea.relH + 1}%` : `${selectedArea.relY}%`,
                transform: selectedArea.relY < 12 ? "translate(-50%, 8px)" : "translate(-50%, calc(-100% - 8px))",
              }}
              className="z-40 pointer-events-auto flex items-center gap-1 sm:gap-1.5 rounded-2xl border border-slate-700/90 bg-slate-900/95 p-1 sm:p-1.5 text-white shadow-2xl backdrop-blur-xl animate-scaleUp select-none max-w-[90vw]"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAiArea?.(selectedArea.text, selectedArea.page);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-brand-500/30 hover:brightness-110 active:scale-95 transition"
                title="Open in AI Assistant to analyze this selected area"
              >
                <SparklesIcon size={15} className="text-amber-300" />
                <span>Ask AI</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissArea?.();
                }}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-95"
                title="Dismiss Selection Box"
              >
                <XIcon size={15} />
              </button>
            </div>
          )}
        </>
      )}

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
