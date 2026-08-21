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
import VirtualPage, { SelectedAreaBox } from "./VirtualPage";
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

const RENDER_BUFFER = 4; // Active page ± 4 pages rendered with full canvas/text layer
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
  isActive?: boolean;
  selectedArea?: SelectedAreaBox | null;
  onAskAiArea?: (text: string, page: number) => void;
  onDismissArea?: () => void;
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
  isActive = true,
  selectedArea,
  onAskAiArea,
  onDismissArea,
  onPageChange,
  onNumPagesChange,
  onPdfDocLoaded,
  onTextSelected,
}: ContinuousViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map());

  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

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
  const isInternalScrollRef = useRef<boolean>(true);

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

  const initialScrolledRef = useRef(false);
  const targetPageRef = useRef<number>(currentPage || tab.currentPage || 1);

  // Keep targetPageRef updated if currentPage changes from outside
  useEffect(() => {
    if (currentPage && currentPage > 0) {
      targetPageRef.current = currentPage;
    }
  }, [currentPage]);

  // Register page DOM elements for intersection observation & jumping
  const registerPageElement = useCallback(
    (pageNum: number, el: HTMLDivElement | null) => {
      if (el) {
        pageEls.current.set(pageNum, el);
        // Instant fine-tune position if target page element mounts during initial load
        if (
          pageNum === targetPageRef.current &&
          !initialScrolledRef.current &&
          pageNum > 1
        ) {
          const container = containerRef.current;
          if (container && el.offsetTop > 0) {
            container.scrollTop = el.offsetTop;
            setRenderCenter(pageNum);
          }
        }
      } else {
        pageEls.current.delete(pageNum);
      }
    },
    []
  );

  // Smooth scroll or instant jump to a target page
  const scrollToPage = useCallback(
    (targetPage: number, smooth = true) => {
      if (!containerRef.current || targetPage <= 0) return;
      isInternalScrollRef.current = true;
      setRenderCenter(targetPage);

      const targetEl = pageEls.current.get(targetPage);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      } else {
        const estimatedHeight = pageWidth ? Math.round(pageWidth / aspectRatio) + 24 : 800;
        const targetScrollTop = (targetPage - 1) * estimatedHeight;
        containerRef.current.scrollTo({
          top: targetScrollTop,
          behavior: smooth ? "smooth" : "auto",
        });
      }

      setTimeout(() => {
        isInternalScrollRef.current = false;
      }, smooth ? 800 : 350);
    },
    [aspectRatio, pageWidth]
  );

  // Initial scroll restore with RAF retry loop to ensure DOM layout has completed
  useEffect(() => {
    if (numPages === 0 || !isActive) return;
    const initialTarget = targetPageRef.current;
    if (initialTarget <= 1) {
      initialScrolledRef.current = true;
      isInternalScrollRef.current = false;
      return;
    }

    if (!initialScrolledRef.current) {
      isInternalScrollRef.current = true;
      setRenderCenter(initialTarget);

      let rafId: number;
      let attempts = 0;
      let unlockTimer: NodeJS.Timeout | null = null;

      const attemptScroll = () => {
        const container = containerRef.current;
        const targetEl = pageEls.current.get(initialTarget);
        const estimatedHeight = pageWidth ? Math.round(pageWidth / aspectRatio) + 24 : 800;
        const targetScrollTop =
          targetEl && targetEl.offsetTop > 0
            ? targetEl.offsetTop
            : (initialTarget - 1) * estimatedHeight;

        if (container && isActive) {
          if (targetEl && targetEl.offsetTop > 0) {
            container.scrollTop = targetEl.offsetTop;
            if (unlockTimer) clearTimeout(unlockTimer);
            unlockTimer = setTimeout(() => {
              initialScrolledRef.current = true;
              isInternalScrollRef.current = false;
            }, 350);
            return;
          }

          if (container.scrollHeight > estimatedHeight * 1.5) {
            container.scrollTop = targetScrollTop;
            if (container.scrollTop > 0) {
              if (unlockTimer) clearTimeout(unlockTimer);
              unlockTimer = setTimeout(() => {
                initialScrolledRef.current = true;
                isInternalScrollRef.current = false;
              }, 350);
              return;
            }
          }
        }

        attempts++;
        if (attempts < 60) {
          rafId = requestAnimationFrame(attemptScroll);
        } else {
          // Fallback: force scroll to target position and unlock
          if (container) {
            container.scrollTop = targetScrollTop;
          }
          if (unlockTimer) clearTimeout(unlockTimer);
          unlockTimer = setTimeout(() => {
            initialScrolledRef.current = true;
            isInternalScrollRef.current = false;
          }, 350);
        }
      };

      rafId = requestAnimationFrame(attemptScroll);
      return () => {
        cancelAnimationFrame(rafId);
        if (unlockTimer) clearTimeout(unlockTimer);
      };
    }
  }, [numPages, pageWidth, aspectRatio, isActive]);

  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Jump to currentPage when requested from outside (e.g. TOC, bookmark, jump input)
  // BUT do NOT trigger while the user is actively scrolling the viewer!
  useEffect(() => {
    if (
      isActive &&
      currentPage &&
      numPages > 0 &&
      initialScrolledRef.current &&
      !isUserScrollingRef.current &&
      !isInternalScrollRef.current &&
      currentPage !== renderCenter
    ) {
      scrollToPage(currentPage, true);
    }
  }, [isActive, currentPage, numPages, renderCenter, scrollToPage]);

  // Scroll listener to keep renderCenter tightly synced with viewport
  const handleScroll = useCallback(() => {
    if (!isActive || !initialScrolledRef.current) return;
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    // Mark active user scrolling to prevent layout fighting
    isUserScrollingRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 350);

    if (isInternalScrollRef.current) return;

    const containerHeight = container.clientHeight || 800;
    const scrollTarget = container.scrollTop + containerHeight * 0.35;
    let currentVisible = -1;

    for (const [pageNum, el] of pageEls.current.entries()) {
      if (el && el.offsetTop <= scrollTarget && el.offsetTop + el.offsetHeight > scrollTarget) {
        currentVisible = pageNum;
        break;
      }
    }

    if (currentVisible <= 0) {
      const estimatedHeight = pageWidth ? Math.round(pageWidth / aspectRatio) + 24 : 800;
      currentVisible = Math.max(1, Math.min(numPages, Math.round(container.scrollTop / estimatedHeight) + 1));
    }

    if (currentVisible > 0 && currentVisible !== renderCenter) {
      setRenderCenter(currentVisible);
      onPageChangeRef.current(currentVisible);
    }
  }, [isActive, numPages, pageWidth, aspectRatio, renderCenter]);

  // IntersectionObserver to continuously track which page is in viewport
  useEffect(() => {
    if (numPages === 0 || !containerRef.current || !isActive) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!isActive || isInternalScrollRef.current || isUserScrollingRef.current || !initialScrolledRef.current) return;

        let mostVisiblePage = -1;
        let maxRatio = 0;

        for (const entry of entries) {
          const pageNum = Number(entry.target.getAttribute("data-page-number"));
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisiblePage = pageNum;
          }
        }

        if (mostVisiblePage > 0 && maxRatio > 0.15 && mostVisiblePage !== renderCenter) {
          setRenderCenter(mostVisiblePage);
          onPageChangeRef.current(mostVisiblePage);
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
  }, [isActive, numPages, renderCenter]);

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
      onScroll={handleScroll}
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
                      selectedArea={selectedArea}
                      onAskAiArea={onAskAiArea}
                      onDismissArea={onDismissArea}
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
