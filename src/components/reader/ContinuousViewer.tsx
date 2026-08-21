"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Document } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "@/lib/pdf"; // Worker initialized
import VirtualPage from "./VirtualPage";
import { DocumentTab } from "./context/ReaderTabContext";
import { BookLoader, Button } from "@/components/ui";
import { AlertTriangleIcon } from "@/components/ui/icons";

import { BookmarkData, HighlightData, NoteData } from "@/lib/readingService";

const PDF_OPTIONS = {
  cMapUrl: "/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/standard_fonts/",
  disableAutoFetch: false,
  disableStream: false,
};

const RENDER_BUFFER = 2; // Active page ± 2 pages rendered with full canvas/text layer
const EMPTY_BOOKMARKS: BookmarkData[] = [];
const EMPTY_HIGHLIGHTS: HighlightData[] = [];
const EMPTY_NOTES: NoteData[] = [];

interface ContinuousViewerProps {
  tab: DocumentTab;
  fileUrl: string;
  theme: "light" | "dark" | "sepia";
  currentPage: number;
  scale: number;
  fitWidth: boolean;
  onPageChange: (page: number) => void;
  onNumPagesChange: (numPages: number) => void;
  onPdfDocLoaded: (doc: any) => void;
  onTextSelected: (selectedText: string, position: { top: number; left: number }, page: number) => void;
}

function ContinuousViewerComponent({
  tab,
  fileUrl,
  theme,
  currentPage,
  scale,
  fitWidth,
  onPageChange,
  onNumPagesChange,
  onPdfDocLoaded,
  onTextSelected,
}: ContinuousViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map());

  const [numPages, setNumPages] = useState<number>(tab.pageCount || 0);
  const [renderCenter, setRenderCenter] = useState<number>(currentPage || tab.currentPage || 1);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [aspectRatio, setAspectRatio] = useState<number>(0.707);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [dpr] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Math.min(window.devicePixelRatio || 1.5, 2.0);
    }
    return 1.5;
  });
  const [isScrollingInternally, setIsScrollingInternally] = useState(false);

  // Measure container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateDimensions();
    const ro = new ResizeObserver(updateDimensions);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Compute calculated page pixel width
  const pageWidth = useMemo(() => {
    if (fitWidth) {
      const available = containerWidth - 32;
      return Math.max(300, Math.min(available, 960));
    }
    const base = 800 * scale;
    return Math.max(300, base);
  }, [containerWidth, fitWidth, scale]);

  // Handle PDF document load success
  const handleDocumentLoadSuccess = async (doc: any) => {
    setNumPages(doc.numPages);
    onNumPagesChange(doc.numPages);
    onPdfDocLoaded(doc);
    setLoadError(false);

    // Calculate real aspect ratio from page 1
    try {
      const page1 = await doc.getPage(1);
      const vp = page1.getViewport({ scale: 1 });
      if (vp.width && vp.height) {
        setAspectRatio(vp.width / vp.height);
      }
    } catch {
      /* fallback */
    }
  };

  // Register page DOM elements for intersection observation & jumping
  const registerPageElement = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageEls.current.set(pageNum, el);
    } else {
      pageEls.current.delete(pageNum);
    }
  }, []);

  // IntersectionObserver to continuously track which page is in viewport
  useEffect(() => {
    if (numPages === 0 || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingInternally) return;

        let mostVisiblePage = -1;
        let maxRatio = 0;

        for (const entry of entries) {
          const pageNum = Number(entry.target.getAttribute("data-page-number"));
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisiblePage = pageNum;
          }
        }

        if (mostVisiblePage > 0 && maxRatio > 0.15) {
          setRenderCenter(mostVisiblePage);
          onPageChange(mostVisiblePage);
        }
      },
      {
        root: containerRef.current,
        rootMargin: "0px",
        threshold: [0.1, 0.3, 0.5, 0.7, 0.9],
      }
    );

    pageEls.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [numPages, isScrollingInternally, onPageChange]);

  // Smooth scroll to a target page when requested (e.g. from toolbar / TOC / AI citations)
  const scrollToPage = useCallback(
    (targetPage: number) => {
      const targetEl = pageEls.current.get(targetPage);
      if (targetEl && containerRef.current) {
        setIsScrollingInternally(true);
        setRenderCenter(targetPage);
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => setIsScrollingInternally(false), 800);
      }
    },
    []
  );

  // Jump to currentPage on initial mount or when currentPage updates from outside
  useEffect(() => {
    if (currentPage && numPages > 0 && currentPage !== renderCenter) {
      scrollToPage(currentPage);
    }
  }, [currentPage, numPages, renderCenter, scrollToPage]);

  // Robust Text selection handler for floating HUD on Desktop & Mobile
  const handleSelectionCheck = useCallback(() => {
    if (typeof window === "undefined") return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text || text.length < 2) return;

    const container = containerRef.current;
    if (!container) return;

    try {
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer) && !container.contains(range.startContainer)) {
        return;
      }

      const rect = range.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) {
        let targetPage = renderCenter;
        let parentNode: Node | null = range.startContainer;
        while (parentNode && parentNode !== document.body) {
          if (
            parentNode instanceof HTMLElement &&
            parentNode.hasAttribute("data-page-number")
          ) {
            targetPage = Number(parentNode.getAttribute("data-page-number"));
            break;
          }
          parentNode = parentNode.parentNode;
        }

        onTextSelected(
          text,
          {
            top: rect.top,
            left: rect.left + rect.width / 2,
          },
          targetPage
        );
      }
    } catch {
      /* Selection out of bounds */
    }
  }, [renderCenter, onTextSelected]);

  useEffect(() => {
    const onDocMouseUp = () => {
      // Small tick to ensure selection is finalized by browser
      setTimeout(handleSelectionCheck, 10);
    };

    const onDocTouchEnd = () => {
      setTimeout(handleSelectionCheck, 100);
    };

    document.addEventListener("mouseup", onDocMouseUp);
    document.addEventListener("touchend", onDocTouchEnd);
    return () => {
      document.removeEventListener("mouseup", onDocMouseUp);
      document.removeEventListener("touchend", onDocTouchEnd);
    };
  }, [handleSelectionCheck]);

  const bookmarksByPage = useMemo(() => {
    const map = new Map<number, BookmarkData[]>();
    for (const b of tab.bookmarks || []) {
      const list = map.get(b.page) || [];
      list.push(b);
      map.set(b.page, list);
    }
    return map;
  }, [tab.bookmarks]);

  const highlightsByPage = useMemo(() => {
    const map = new Map<number, HighlightData[]>();
    for (const h of tab.highlights || []) {
      const list = map.get(h.page) || [];
      list.push(h);
      map.set(h.page, list);
    }
    return map;
  }, [tab.highlights]);

  const notesByPage = useMemo(() => {
    const map = new Map<number, NoteData[]>();
    for (const n of tab.notes || []) {
      const list = map.get(n.page) || [];
      list.push(n);
      map.set(n.page, list);
    }
    return map;
  }, [tab.notes]);

  const themeStyle =
    theme === "sepia"
      ? "bg-[#ede3ce]"
      : theme === "dark"
      ? "bg-slate-950"
      : "bg-slate-100/90";

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 h-full w-full overflow-y-auto overflow-x-hidden select-text transition-colors duration-200 ${themeStyle}`}
    >
      <div className="mx-auto flex flex-col items-center py-4 sm:py-6 px-1.5 sm:px-3 pb-24 md:pb-6 min-h-full">
        {loadError ? (
          <div className="flex h-96 flex-col items-center justify-center p-6 text-center space-y-4 rounded-3xl border border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-slate-900 my-12 max-w-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
              <AlertTriangleIcon size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Unable to Load Document
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                The document could not be retrieved from storage. Please check your network or try reloading.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setLoadError(false)}>
                Retry
              </Button>
              <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </div>
          </div>
        ) : (
          <Document
            file={fileUrl}
            options={PDF_OPTIONS}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={(err) => {
              console.error("PDF ContinuousViewer Load Error:", err);
              setLoadError(true);
            }}
            loading={
              <div className="mt-28">
                <BookLoader label={`Opening "${tab.title}"...`} />
              </div>
            }
          >
            {numPages > 0 && (
              <div className="flex w-full flex-col items-center">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                  const isActive = Math.abs(pageNum - renderCenter) <= RENDER_BUFFER;
                  const bookmarksForPage = bookmarksByPage.get(pageNum) || EMPTY_BOOKMARKS;
                  const highlightsForPage = highlightsByPage.get(pageNum) || EMPTY_HIGHLIGHTS;
                  const notesForPage = notesByPage.get(pageNum) || EMPTY_NOTES;

                  return (
                    <VirtualPage
                      key={pageNum}
                      pageNumber={pageNum}
                      width={pageWidth}
                      scale={scale}
                      dpr={dpr}
                      isActive={isActive}
                      aspectRatio={aspectRatio}
                      bookmarks={bookmarksForPage}
                      highlights={highlightsForPage}
                      notes={notesForPage}
                      onPageElementRegister={registerPageElement}
                    />
                  );
                })}
              </div>
            )}
          </Document>
        )}
      </div>
    </div>
  );
}

const ContinuousViewer = React.memo(ContinuousViewerComponent);
export default ContinuousViewer;
