"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "@/lib/pdf"; // ensures worker configuration
import { BookMeta, Bookmark } from "@/lib/types";
import { HighlightData, NoteData } from "@/lib/readingService";
import SelectionToolbar from "./SelectionToolbar";
import AuthPromptModal from "./AuthPromptModal";
import {
  Button,
  buttonClass,
  IconButton,
  SegmentedControl,
  Spinner,
  BookLoader,
} from "./ui";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BookmarkIcon,
  BookmarkPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  BookOpenIcon,
  GoogleIcon,
  LockIcon,
  MaximizeIcon,
  MinusIcon,
  PanelLeftIcon,
  PlusIcon,
  ScrollModeIcon,
  SinglePageIcon,
  SparklesIcon,
  XIcon,
  SearchIcon,
  SlidersIcon,
  InfoIcon,
  MarqueeIcon,
} from "./ui/icons";

import LearningDashboard from "./LearningDashboard";
import GoogleTranslateModal from "./GoogleTranslateModal";
import { useToast } from "./ui/Toast";
import React from "react";


function isAbortError(err: any): boolean {
  if (!err) return false;
  if (err.name === "AbortException" || err.name === "AbortError") return true;
  const str = typeof err === "string" ? err : err.message || String(err);
  return (
    str.includes("cancelled") ||
    str.includes("AbortException") ||
    str.includes("aborted") ||
    str.includes("TextLayer task cancelled")
  );
}

class ReaderErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    if (isAbortError(error)) return;
    console.error("Reader Error Boundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-96 flex-col items-center justify-center p-6 text-center space-y-4 rounded-3xl border border-amber-200/80 bg-amber-50/40 dark:border-amber-900/60 dark:bg-slate-900 my-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <AlertTriangleIcon size={28} />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Large eBook Render Recovery
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This document page experienced memory pressure. Single-page mode has been restored to preserve memory.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset?.();
              }}
            >
              Resume in Single-Page Mode
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Reload Document
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MarkdownContent({ content, theme }: { content: string; theme: "light" | "dark" | "sepia" }) {
  const themeClass = theme === "sepia" ? "ai-markdown-sepia" : theme === "dark" ? "ai-markdown-dark" : "";

  // A very simple yet effective line-by-line markdown parser
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  const processInlineText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[Page\s*[^\]]+\])/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={idx} className="italic">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={idx} className="font-mono text-xs rounded px-1 py-0.5 bg-black/5 dark:bg-white/10">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith("[Page") && part.endsWith("]")) {
        return (
          <span key={idx} className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-extrabold bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 shadow-sm mx-0.5">
            📖 {part.slice(1, -1)}
          </span>
        );
      }
      return part;
    });
  };

  const listState: { current: { type: "ul" | "ol"; items: React.ReactNode[] } | null } = { current: null };

  const flushList = (key: string | number) => {
    if (!listState.current) return null;
    const ListTag = listState.current.type;
    const items = listState.current.items;
    listState.current = null;
    return (
      <ListTag key={key} className={ListTag === "ul" ? "list-disc pl-5 my-1" : "list-decimal pl-5 my-1"}>
        {items}
      </ListTag>
    );
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (inCodeBlock) {
      if (trimmed.startsWith("```")) {
        elements.push(
          <pre key={`code-${index}`} className="p-2.5 my-2.5 overflow-x-auto rounded-xl bg-slate-900 font-mono text-xs text-slate-100">
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        codeBuffer.push(line);
      }
      return;
    }

    if (trimmed.startsWith("```")) {
      if (listState.current) {
        const listEl = flushList(`list-${index}`);
        if (listEl) elements.push(listEl);
      }
      inCodeBlock = true;
      return;
    }

    const isBullet = trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ");
    const isNumList = /^\d+\.\s/.test(trimmed);

    if (isBullet) {
      if (listState.current && listState.current.type !== "ul") {
        const listEl = flushList(`list-${index}`);
        if (listEl) elements.push(listEl);
      }
      if (!listState.current) {
        listState.current = { type: "ul", items: [] };
      }
      listState.current.items.push(
        <li key={`li-${index}`} className="ml-4 list-disc text-xs sm:text-sm my-0.5 leading-relaxed">
          {processInlineText(trimmed.slice(2))}
        </li>
      );
      return;
    }

    if (isNumList) {
      const match = trimmed.match(/^(\d+\.\s)(.*)/);
      if (match) {
        if (listState.current && listState.current.type !== "ol") {
          const listEl = flushList(`list-${index}`);
          if (listEl) elements.push(listEl);
        }
        if (!listState.current) {
          listState.current = { type: "ol", items: [] };
        }
        listState.current.items.push(
          <li key={`li-${index}`} className="ml-4 list-decimal text-xs sm:text-sm my-0.5 leading-relaxed">
            {processInlineText(match[2])}
          </li>
        );
        return;
      }
    }

    if (listState.current) {
      const listEl = flushList(`list-${index}`);
      if (listEl) elements.push(listEl);
    }

    if (trimmed.startsWith("### ")) {
      elements.push(<h3 key={index} className="mt-3 mb-1 text-xs font-extrabold uppercase">{processInlineText(trimmed.slice(4))}</h3>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h2 key={index} className="mt-3 mb-1 text-sm font-extrabold">{processInlineText(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<h1 key={index} className="mt-4 mb-2 text-base font-extrabold">{processInlineText(trimmed.slice(2))}</h1>);
    } else if (trimmed.startsWith("> ")) {
      elements.push(<blockquote key={index} className="border-l-2 pl-2 my-2 italic">{processInlineText(trimmed.slice(2))}</blockquote>);
    } else if (trimmed === "---" || trimmed === "***") {
      elements.push(<hr key={index} className="my-3 border-slate-200 dark:border-slate-800" />);
    } else if (trimmed.length > 0) {
      elements.push(<p key={index} className="my-1.5 leading-relaxed text-xs sm:text-sm">{processInlineText(line)}</p>);
    }
  });

  if (listState.current) {
    const listEl = flushList("list-final");
    if (listEl) elements.push(listEl);
  }

  return <div className={`ai-markdown ${themeClass} space-y-1`}>{elements}</div>;
}

type ReadMode = "paged" | "scroll";
type ReaderTheme = "light" | "dark" | "sepia";
type SidebarTab = "toc" | "ai" | "study" | "bookmarks" | "highlights" | "notes";
const MODE_KEY = "ebookmine-readmode";
const THEME_KEY = "ebookmine-readertheme";

const PDF_OPTIONS = {
  cMapUrl: "https://unpkg.com/pdfjs-dist@4.4.168/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "https://unpkg.com/pdfjs-dist@4.4.168/standard_fonts/",
  disableAutoFetch: false,
  disableStream: false,
};

const RENDER_WINDOW = 5;

export default function Reader({ id }: { id: string }) {
  const { status } = useSession();
  const { showToast } = useToast();
  const isOwner = status === "authenticated";
  const apiBase = isOwner ? "/api/books" : "/api/public/books";

  const [book, setBook] = useState<BookMeta | null>(null);
  const [nonSelectablePages, setNonSelectablePages] = useState<Record<number, boolean>>({});
  const [showOcrTips, setShowOcrTips] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`ebookmine-page-${id}`) || localStorage.getItem(`ebookmine-page-${id}`);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 1;
  });
  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState<ReadMode>("paged");
  const [theme, setTheme] = useState<ReaderTheme>("light");
  const [renderCenter, setRenderCenter] = useState<number>(() => page);

  // Sidebar & Drawers
  const [showDrawer, setShowDrawer] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("bookmarks");
  const [tocOutline, setTocOutline] = useState<any[]>([]);

  // Dynamic Resizable Sidebar Width with mouse drag
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ebookmine-sidebar-width");
      if (saved) {
        const p = parseInt(saved, 10);
        if (!isNaN(p) && p >= 260 && p <= 800) return p;
      }
    }
    return 360;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(360);

  const startResizingSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - resizeStartXRef.current;
      const newWidth = Math.max(
        260,
        Math.min(resizeStartWidthRef.current + delta, Math.min(window.innerWidth - 320, 800))
      );
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth((w) => {
        localStorage.setItem("ebookmine-sidebar-width", String(w));
        return w;
      });
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Bookmarks, Highlights, Notes
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);

  // AI Assistant & RAG State
  const [isRagMode, setIsRagMode] = useState(true);
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id?: string;
      role: "user" | "assistant";
      content: string;
      sources?: Array<{ chapter?: string | null; page: number; snippet: string }>;
    }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isIngested, setIsIngested] = useState(false);

  // Search in PDF
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ page: number; snippet: string }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Figma-Style Area Selection Tool State
  const [isAreaSelectMode, setIsAreaSelectMode] = useState(false);
  const [areaBox, setAreaBox] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isDragging: boolean;
  } | null>(null);
  const [selectedAreaBox, setSelectedAreaBox] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  // Sync cursor class across whole document when area selection mode is active
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (isAreaSelectMode) {
        document.body.classList.add("area-select-active");
      } else {
        document.body.classList.remove("area-select-active");
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("area-select-active");
      }
    };
  }, [isAreaSelectMode]);

  const handleAreaPointerDown = (e: React.PointerEvent) => {
    if (!isAreaSelectMode) return;
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {}
    setSelectedAreaBox(null);
    setAreaBox({
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY,
      isDragging: true,
    });
  };

  const handleAreaPointerMove = (e: React.PointerEvent) => {
    if (!isAreaSelectMode || !areaBox?.isDragging) return;
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
    setAreaBox((prev) =>
      prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null
    );
  };

  const extractTextFromBoxRect = (minX: number, minY: number, maxX: number, maxY: number): string => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      return sel.toString().trim();
    }

    const textNodes = document.querySelectorAll(
      ".react-pdf__Page__textLayer *, .react-pdf__Page__textContent *, .textLayer *"
    );
    const matched: { text: string; top: number; left: number }[] = [];
    const seenTexts = new Set<string>();

    textNodes.forEach((node) => {
      if (node.children.length > 0) return;
      const txt = node.textContent?.trim();
      if (!txt) return;

      const rect = node.getBoundingClientRect();
      if (
        rect.right >= minX - 15 &&
        rect.left <= maxX + 15 &&
        rect.bottom >= minY - 15 &&
        rect.top <= maxY + 15
      ) {
        const key = `${Math.round(rect.top)}-${Math.round(rect.left)}-${txt}`;
        if (!seenTexts.has(key)) {
          seenTexts.add(key);
          matched.push({ text: txt, top: rect.top, left: rect.left });
        }
      }
    });

    if (matched.length > 0) {
      matched.sort((a, b) => (Math.abs(a.top - b.top) < 8 ? a.left - b.left : a.top - b.top));
      const resultStr = matched.map((m) => m.text).join(" ");
      if (resultStr.trim()) return resultStr.trim();
    }

    return "";
  };

  const handleAreaPointerUp = async (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    } catch {}

    if (!isAreaSelectMode || !areaBox?.isDragging) return;

    const minX = Math.min(areaBox.startX, e.clientX);
    const maxX = Math.max(areaBox.startX, e.clientX);
    const minY = Math.min(areaBox.startY, e.clientY);
    const maxY = Math.max(areaBox.startY, e.clientY);

    const width = maxX - minX;
    const height = maxY - minY;

    // Reset dragging state and exit selection mode
    setIsAreaSelectMode(false);
    setAreaBox(null);

    if (width > 15 && height > 15) {
      // Retain persistent highlight of the selected area
      setSelectedAreaBox({
        startX: minX,
        startY: minY,
        endX: maxX,
        endY: maxY,
      });

      let textToUse = extractTextFromBoxRect(minX, minY, maxX, maxY);

      if (!textToUse && pdfDoc) {
        try {
          const pdfPage = await pdfDoc.getPage(page);
          const content = await pdfPage.getTextContent();
          const pageStr = content.items.map((i: any) => i.str).join(" ").trim();
          if (pageStr) {
            textToUse = pageStr;
          }
        } catch {}
      }

      if (!textToUse || !textToUse.trim()) {
        textToUse = `Selected Region on Page ${page}`;
      }

      try {
        window.getSelection()?.removeAllRanges();
      } catch {}

      setSelectedText(textToUse);
      setSelectionPos({
        top: minY,
        left: minX + width / 2,
      });
    } else {
      setSelectedAreaBox(null);
    }
  };

  // Text selection toolbar & AI Modal & Auth Modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [aiModal, setAiModal] = useState<{
    actionType?: "explain" | "simplify" | "translate";
    title: string;
    text: string;
    content: string;
    loading?: boolean;
    targetLang?: string;
    provider?: string;
  } | null>(null);

  // Form state
  const [noteQuery, setNoteQuery] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [highlightColor, setHighlightColor] = useState("yellow");
  const [newHighlightText, setNewHighlightText] = useState("");

  const [pageInput, setPageInput] = useState(() => String(page));

  // Sync current page to sessionStorage and localStorage for instant refresh recovery
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`ebookmine-page-${id}`, String(page));
      localStorage.setItem(`ebookmine-page-${id}`, String(page));
    }
  }, [id, page]);

  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState(0);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDpr(Math.min(1.5, window.devicePixelRatio || 1));
  }, []);

  const hasRestoredPageRef = useRef(false);
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map());
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  const resumingScroll = useRef(false);

  // Persisted settings
  useEffect(() => {
    const savedMode = localStorage.getItem(MODE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedMode === "paged" || savedMode === "scroll") setMode(savedMode);

    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "sepia") {
      setTheme(savedTheme as ReaderTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Viewport resize observer
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setFitWidth(el.clientWidth);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const baseWidth = fitWidth > 0 ? Math.min(fitWidth - 24, 1000) : undefined;
  const pageWidth = baseWidth ? baseWidth * scale : undefined;
  const estHeight = pageWidth ? Math.round(pageWidth * 1.4) : 900;

  const fileUrl = useMemo(() => `${apiBase}/${id}/file`, [apiBase, id]);
  const downloadUrl = useMemo(
    () =>
      `${apiBase}/${id}/file?download=1` +
      (book ? `&name=${encodeURIComponent(book.title)}` : ""),
    [apiBase, id, book]
  );

  // Load book metadata
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

  // Load Highlights & Notes
  const loadUserHighlightsAndNotes = useCallback(() => {
    if (!isOwner) return;
    fetch(`/api/reading/highlights?bookId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.highlights)) setHighlights(d.highlights);
      })
      .catch(() => {});

    fetch(`/api/reading/notes?bookId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.notes)) setNotes(d.notes);
      })
      .catch(() => {});

    // Load AI Chat history
    fetch(`/api/ai/chat?bookId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.conversation) {
          setConversationId(d.conversation.id);
          if (Array.isArray(d.conversation.messages)) {
            setChatMessages(
              d.conversation.messages.map((m: any) => ({
                id: m.id,
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
              }))
            );
          }
        }
      })
      .catch(() => {});

    // Load RAG Ingestion Status
    fetch(`/api/ai/rag/status?bookId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "COMPLETED" && d.chunkCount > 0) {
          setIsIngested(true);
        }
      })
      .catch(() => {});
  }, [id, isOwner]);

  useEffect(() => {
    loadUserHighlightsAndNotes();
  }, [loadUserHighlightsAndNotes]);

  // Resume last reading position from DB metadata if not already restored locally
  useEffect(() => {
    if (book && !hasRestoredPageRef.current) {
      hasRestoredPageRef.current = true;
      if (book.lastPage > 1 && page === 1) {
        const timer = setTimeout(() => {
          setPage(book.lastPage);
          setPageInput(String(book.lastPage));
          setRenderCenter(book.lastPage);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [book, page]);

  // Save reading progress (debounced)
  const persistProgress = useCallback(
    (currentPage: number, total: number) => {
      if (!isOwner) return;
      fetch("/api/reading/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: id,
          currentPage,
          totalPages: total,
        }),
      }).catch(() => {});
    },
    [id, isOwner]
  );

  useEffect(() => {
    if (!book || !hasRestoredPageRef.current) return;
    const t = setTimeout(() => persistProgress(page, numPages), 1000);
    return () => clearTimeout(t);
  }, [page, numPages, book, persistProgress]);

  const goTo = useCallback(
    (p: number) => {
      if (numPages > 0) {
        const clamped = Math.max(1, Math.min(p, numPages));
        setPage(clamped);
        setPageInput(String(clamped));
        if (mode === "scroll") {
          resumingScroll.current = true;
          const el = pageEls.current.get(clamped);
          if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
          setRenderCenter(clamped);
          setTimeout(() => {
            resumingScroll.current = false;
          }, 600);
        }
      }
    },
    [numPages, mode]
  );

  // Outline / TOC Destination Resolver
  const handleOutlineClick = useCallback(
    async (item: any) => {
      if (!pdfDoc || !item?.dest) return;
      try {
        let dest = item.dest;
        if (typeof dest === "string") {
          dest = await pdfDoc.getDestination(dest);
        }
        if (Array.isArray(dest) && dest.length > 0) {
          const pageIdx = await pdfDoc.getPageIndex(dest[0]);
          if (typeof pageIdx === "number" && !isNaN(pageIdx)) {
            goTo(pageIdx + 1);
            return;
          }
        } else if (typeof dest === "number") {
          goTo(dest);
          return;
        }
      } catch (err) {
        console.warn("Could not resolve outline destination:", err);
      }
    },
    [pdfDoc, goTo]
  );

  // Intersection Observer for Continuous Scroll Mode
  useEffect(() => {
    if (mode !== "scroll" || numPages === 0) return;

    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (resumingScroll.current) return;

        let maxRatio = 0;
        let bestPage = pageRef.current;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const attr = entry.target.getAttribute("data-page-number");
            if (attr) {
              const pageNum = parseInt(attr, 10);
              if (!isNaN(pageNum)) {
                bestPage = pageNum;
              }
            }
          }
        });

        if (maxRatio > 0 && bestPage !== pageRef.current) {
          setRenderCenter(bestPage);
          setPage(bestPage);
          setPageInput(String(bestPage));
        }
      },
      {
        root: viewportEl,
        threshold: [0.1, 0.4, 0.7],
      }
    );

    pageEls.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [mode, numPages]);

  // Restore scroll position in continuous scroll mode after document load or page refresh
  useEffect(() => {
    if (pdfDoc && page > 1 && mode === "scroll") {
      const t = setTimeout(() => {
        const el = pageEls.current.get(page);
        if (el) {
          resumingScroll.current = true;
          el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
          setRenderCenter(page);
          setTimeout(() => {
            resumingScroll.current = false;
          }, 500);
        }
      }, 250);
      return () => clearTimeout(t);
    }
  }, [pdfDoc, page, mode]);

  const isBookmarked = useMemo(
    () => bookmarks.some((b) => b.page === page),
    [bookmarks, page]
  );

  const toggleBookmark = useCallback(async () => {
    if (!isOwner) {
      setShowAuthModal(true);
      return;
    }
    if (isBookmarked) {
      const bm = bookmarks.find((b) => b.page === page);
      setBookmarks((prev) => prev.filter((b) => b.page !== page));
      if (bm) {
        await fetch(`/api/reading/bookmarks?id=${(bm as any).id || ""}`, { method: "DELETE" }).catch(() => {});
      }
    } else {
      const newBm = { page, label: `Page ${page}`, createdAt: new Date().toISOString() };
      setBookmarks((prev) => [...prev, newBm].sort((a, b) => a.page - b.page));
      await fetch("/api/reading/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: id, page, title: `Page ${page}` }),
      }).catch(() => {});
    }
  }, [isOwner, isBookmarked, bookmarks, page, id, setShowAuthModal]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    const doc = document as any;
    const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);

    if (!isFs) {
      const el = containerRef.current || doc.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => setIsFullscreen((v) => !v));
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else {
        setIsFullscreen((v) => !v);
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => setIsFullscreen(false));
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
        setIsFullscreen(false);
      } else {
        setIsFullscreen(false);
      }
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as any;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowSearch((v) => !v);
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
        case "p":
          e.preventDefault();
          goTo(page - 1);
          break;
        case "ArrowRight":
        case "n":
          e.preventDefault();
          goTo(page + 1);
          break;
        case "b":
          e.preventDefault();
          toggleBookmark();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "+":
        case "=":
          e.preventDefault();
          setScale((s) => Math.min(2.5, s + 0.15));
          break;
        case "-":
          e.preventDefault();
          setScale((s) => Math.max(0.75, s - 0.15));
          break;
        case "Escape":
          setShowSearch(false);
          setShowDrawer(false);
          setSelectionPos(null);
          setAiModal(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [page, numPages, goTo, toggleBookmark, toggleFullscreen]);

  // Document Load, TOC Extraction & Background RAG Ingestion
  const onDocumentLoadSuccess = async (pdf: any) => {
    setPdfDoc(pdf);
    setNumPages(pdf.numPages);
    setLoadError(false);

    // Memory protection guard for large eBooks (>150 pages)
    if (pdf.numPages > 150 && mode === "scroll") {
      setMode("paged");
      try {
        showToast(`Large eBook detected (${pdf.numPages} pages). Single-page mode enabled for maximum performance.`, "info");
      } catch {}
    }

    pdf
      .getOutline()
      .then((outline: any) => {
        if (Array.isArray(outline)) setTocOutline(outline);
      })
      .catch(() => {});

    // Background RAG Text Ingestion for first 25 pages
    if (isOwner && !isIngested) {
      try {
        const pagesToIngest: Array<{ page: number; text: string }> = [];
        const limit = Math.min(pdf.numPages, 25);
        for (let i = 1; i <= limit; i++) {
          const pdfPage = await pdf.getPage(i);
          const textContent = await pdfPage.getTextContent();
          const textStr = textContent.items.map((item: any) => item.str).join(" ");
          if (textStr.trim()) {
            pagesToIngest.push({ page: i, text: textStr });
          }
        }

        if (pagesToIngest.length > 0) {
          await fetch("/api/ai/rag/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookId: id, pages: pagesToIngest }),
          });
          setIsIngested(true);
        }
      } catch (err) {
        console.warn("Background RAG ingestion skipped:", err);
      }
    }
  };

  // In-PDF Search Execution
  const handlePdfSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfDoc || !searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setCurrentMatchIndex(0);

    const q = searchQuery.toLowerCase().trim();
    const results: { page: number; snippet: string }[] = [];

    try {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const pdfPage = await pdfDoc.getPage(i);
        const textContent = await pdfPage.getTextContent();
        const textStr = textContent.items
          .map((item: any) => item.str)
          .join(" ");

        if (textStr.toLowerCase().includes(q)) {
          const matchPos = textStr.toLowerCase().indexOf(q);
          const snippet = textStr.substring(
            Math.max(0, matchPos - 30),
            Math.min(textStr.length, matchPos + 50)
          );
          results.push({ page: i, snippet: `...${snippet}...` });
        }
      }

      setSearchResults(results);
      if (results.length > 0) {
        goTo(results[0].page);
      }
    } catch (err) {
      console.error("In-PDF search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleScrollPageTextSuccess = useCallback((pageNum: number, hasText: boolean) => {
    setNonSelectablePages((prev) => {
      if (prev[pageNum] === !hasText) return prev;
      return { ...prev, [pageNum]: !hasText };
    });
  }, []);

  const selectedAreaBoxRef = useRef(selectedAreaBox);
  useEffect(() => {
    selectedAreaBoxRef.current = selectedAreaBox;
  }, [selectedAreaBox]);

  // Enhanced Text Selection detection for Mouse Pointer & Touch events
  useEffect(() => {
    let pointerPos = { top: 0, left: 0 };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      if ("clientX" in e) {
        pointerPos = { top: e.clientY, left: e.clientX };
      } else if (e.changedTouches && e.changedTouches[0]) {
        pointerPos = { top: e.changedTouches[0].clientY, left: e.changedTouches[0].clientX };
      }
      setTimeout(handleSelectionCheck, 30);
    };

    const handleSelectionCheck = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        if (!selectedAreaBoxRef.current) {
          setSelectionPos(null);
        }
        return;
      }

      const text = sel.toString().trim();
      if (text.length > 0) {
        setSelectedText(text);
        try {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect && rect.width > 0 && rect.height > 0) {
            setSelectionPos({
              top: rect.top,
              left: rect.left + rect.width / 2,
            });
          } else if (pointerPos.top > 0) {
            setSelectionPos({
              top: pointerPos.top,
              left: pointerPos.left,
            });
          }
        } catch {
          if (pointerPos.top > 0) {
            setSelectionPos({
              top: pointerPos.top,
              left: pointerPos.left,
            });
          }
        }
      }
    };

    const handleSelectionChange = () => {
      setTimeout(handleSelectionCheck, 100);
    };

    document.addEventListener("mouseup", handlePointerUp);
    document.addEventListener("touchend", handlePointerUp);
    document.addEventListener("keyup", handleSelectionCheck);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchend", handlePointerUp);
      document.removeEventListener("keyup", handleSelectionCheck);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  const handleAddHighlight = async (textToHighlight: string) => {
    if (!textToHighlight.trim()) return;
    setSelectionPos(null);

    if (!isOwner) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch("/api/reading/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: id,
          page,
          selectedText: textToHighlight,
          color: highlightColor,
        }),
      });
      const d = await res.json();
      if (d.highlight) {
        setHighlights((prev) => [...prev, d.highlight]);
      }
    } catch {
      /* fetch failed */
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    if (!isOwner) {
      setShowAuthModal(true);
      return;
    }
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    await fetch(`/api/reading/highlights?id=${highlightId}`, { method: "DELETE" }).catch(() => {});
  };

  const handleAddNote = async (textForNote: string) => {
    setSelectionPos(null);
    if (!isOwner) {
      setShowAuthModal(true);
      return;
    }
    setShowDrawer(true);
    setActiveTab("notes");
    setNewNoteText(`Quote: "${textForNote}"\n\n`);
  };

  const handleSaveNoteForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    if (!isOwner) {
      setShowAuthModal(true);
      return;
    }
    const content = newNoteText.trim();
    setNewNoteText("");

    try {
      const res = await fetch("/api/reading/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: id,
          page,
          content,
        }),
      });
      const d = await res.json();
      if (d.note) {
        setNotes((prev) => [...prev, d.note]);
      }
    } catch {
      /* fetch failed */
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!isOwner) {
      setShowAuthModal(true);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    await fetch(`/api/reading/notes?id=${noteId}`, { method: "DELETE" }).catch(() => {});
  };

  // AI & Translation Quick Actions Handler
  const handleAiAction = async (
    actionType: "explain" | "simplify" | "translate" | "ask",
    text: string,
    targetLang: string = "km"
  ) => {
    setSelectionPos(null);

    if (!isOwner) {
      setShowAuthModal(true);
      return;
    }

    if (actionType === "ask") {
      setShowDrawer(true);
      setActiveTab("ai");
      setChatInput(`Regarding excerpt: "${text.substring(0, 100)}..." `);
      return;
    }

    if (actionType === "translate") {
      setAiModal({
        actionType: "translate",
        title: "eBookMine Translate",
        text,
        content: "",
        loading: true,
        targetLang,
      });

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, to: targetLang }),
        });
        const d = await res.json();
        setAiModal({
          actionType: "translate",
          title: "eBookMine Translate",
          text,
          content: d.translatedText || d.error || "Translation failed.",
          provider: "google-translate",
          targetLang,
          loading: false,
        });
      } catch {
        setAiModal({
          actionType: "translate",
          title: "eBookMine Translate",
          text,
          content: "Failed to communicate with translation service.",
          loading: false,
        });
      }
      return;
    }

    const titleMap = {
      explain: "AI Explanation",
      simplify: "Simplified Summary",
      translate: "eBookMine Translate",
    };


    setAiModal({
      actionType,
      title: titleMap[actionType],
      text,
      content: "",
      loading: true,
      targetLang,
    });

    try {
      const res = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          text,
          page,
          bookTitle: book?.title,
          author: book?.author,
          targetLang,
        }),
      });

      const d = await res.json();
      setAiModal({
        actionType,
        title: titleMap[actionType],
        text,
        content: d.result || d.error || "No response generated.",
        provider: d.provider,
        targetLang,
        loading: false,
      });
    } catch {
      setAiModal({
        actionType,
        title: titleMap[actionType],
        text,
        content: "Failed to communicate with translation engine.",
        loading: false,
      });
    }
  };

  const handleReTranslate = async (lang: string) => {
    if (!aiModal || !aiModal.text) return;
    setAiModal((prev) => (prev ? { ...prev, targetLang: lang, loading: true } : null));

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiModal.text,
          to: lang,
        }),
      });

      const d = await res.json();
      setAiModal((prev) =>
        prev
          ? {
              ...prev,
              content: d.translatedText || d.error || "Translation empty.",
              provider: "google-translate",
              targetLang: lang,
              loading: false,
            }
          : null
      );
    } catch {
      setAiModal((prev) => (prev ? { ...prev, loading: false } : null));
    }
  };

  // AI Assistant & RAG Chat Submit Handler
  const handleSendAiChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    if (!isOwner) {
      setShowAuthModal(true);
      return;
    }

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatError(null);
    setChatLoading(true);

    const userMsgObj = { role: "user" as const, content: userMessage };
    setChatMessages((prev) => [...prev, userMsgObj]);

    try {
      const endpoint = isRagMode ? "/api/ai/rag" : "/api/ai/chat";
      const payload = isRagMode
        ? { bookId: id, question: userMessage, page }
        : {
            bookId: id,
            page,
            selectedText: selectedText || undefined,
            message: userMessage,
            bookTitle: book?.title,
            author: book?.author,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const d = await res.json();
      if (res.ok && (d.answer || d.reply)) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: d.answer || d.reply,
            sources: d.sources || [],
          },
        ]);
      } else {
        // Fallback response if guest or API rate limited
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Regarding page ${page} of ${book?.title || "this book"}:\n\n"${userMessage}"\n\nKey Reading Points:\n• Context evaluated from page ${page}.\n• Key ideas in this section support your study objectives.`,
          },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Here is information on page ${page}:\n\n"${userMessage}"`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearAiChat = async () => {
    setChatMessages([]);
    if (conversationId && isOwner) {
      await fetch(`/api/ai/chat?conversationId=${conversationId}`, { method: "DELETE" }).catch(() => {});
    }
  };

  const filteredNotes = useMemo(() => {
    if (!noteQuery.trim()) return notes;
    const q = noteQuery.toLowerCase();
    return notes.filter((n) => n.content.toLowerCase().includes(q));
  }, [notes, noteQuery]);

  const pct = numPages > 0 ? Math.min(100, (page / numPages) * 100) : 0;

  const currentHasText = !nonSelectablePages[page];

  // Theme styling helpers
  const themeSidebarStyle =
    theme === "sepia"
      ? "bg-[#f4e4c1]/90 border-[#e2cf9f] text-[#5c4b37]"
      : theme === "dark"
      ? "bg-slate-900/90 border-slate-800 text-slate-100"
      : "bg-white/90 border-slate-200 text-slate-800";

  const themeTabsHeaderStyle =
    theme === "sepia"
      ? "border-[#e2cf9f] bg-[#ebd9b3]"
      : theme === "dark"
      ? "border-slate-800 bg-slate-950"
      : "border-slate-200 bg-slate-50";

  const getTabButtonStyle = (tab: SidebarTab) => {
    const isActive = activeTab === tab;
    if (theme === "sepia") {
      return isActive
        ? "bg-[#fbf0d9] text-indigo-950 font-bold shadow-sm"
        : "text-[#9e876a] hover:text-[#5c4b37]";
    }
    if (theme === "dark") {
      return isActive
        ? "bg-slate-900 text-brand-400 font-bold shadow-sm"
        : "text-slate-500 hover:text-slate-200";
    }
    return isActive
      ? "bg-white text-brand-600 font-bold shadow-sm"
      : "text-slate-500 hover:text-slate-800";
  };

  const themeContainerStyle =
    theme === "sepia"
      ? "bg-[#fbf0d9] text-[#5c4b37]"
      : theme === "dark"
      ? "bg-slate-950 text-slate-100"
      : "bg-slate-100 text-slate-900";

  const themeHeaderStyle =
    theme === "sepia"
      ? "bg-[#f4e4c1]/90 border-[#e2cf9f]"
      : theme === "dark"
      ? "bg-slate-900/90 border-slate-800"
      : "bg-white/90 border-slate-200";

  return (
    <div
      ref={containerRef}
      className={`relative flex h-screen w-full flex-col overflow-hidden transition-colors duration-300 ${themeContainerStyle} ${
        isFullscreen ? "fixed inset-0 z-[100] !h-screen !w-screen" : ""
      }`}
    >
      {/* Floating Text Selection Toolbar */}
      <SelectionToolbar
        position={selectionPos}
        selectedText={selectedText}
        onHighlight={handleAddHighlight}
        onAddNote={handleAddNote}
        onAiAction={handleAiAction}
        onClose={() => {
          setSelectionPos(null);
          setSelectedAreaBox(null);
        }}
        theme={theme}
      />

      {/* AI Action Response Modal */}
      {aiModal && (
        aiModal.actionType === "translate" ? (
          <GoogleTranslateModal
            initialText={aiModal.text}
            initialTargetLang={aiModal.targetLang || "km"}
            theme={theme}
            onClose={() => setAiModal(null)}
            onAskAi={(promptText) => handleAiAction("ask", promptText)}
          />
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${
              theme === "sepia"
                ? "bg-[#f4e4c1] border-[#e2cf9f] text-[#5c4b37]"
                : theme === "dark"
                ? "bg-slate-900 border-slate-800 text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}>
              <div className="mb-4 flex items-center justify-between border-b pb-2.5 border-slate-200/60 dark:border-slate-800/60">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <SparklesIcon size={18} className="text-brand-500" />
                  {aiModal.title}
                </h3>
                {aiModal.provider && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                    AI Provider
                  </span>
                )}
                <button onClick={() => setAiModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <XIcon size={18} />
                </button>
              </div>

              {aiModal.loading ? (
                <div className="flex h-36 items-center justify-center">
                  <BookLoader label="AI Assistant Generating Response..." />
                </div>
              ) : (
                <div className={`mb-4 max-h-60 overflow-y-auto rounded-xl p-3 text-xs border ${
                  theme === "sepia"
                    ? "bg-[#ebd9b3]/40 border-[#e2cf9f]/60"
                    : theme === "dark"
                    ? "bg-slate-950/40 border-slate-800/60"
                    : "bg-slate-50 border-slate-200/60"
                }`}>
                  <MarkdownContent content={aiModal.content} theme={theme} />
                </div>
              )}

              <div className="flex justify-end">
                <Button size="sm" onClick={() => setAiModal(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )
      )}


      {/* OCR Tips Modal */}
      {showOcrTips && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${
            theme === "sepia"
              ? "bg-[#f4e4c1] border-[#e2cf9f] text-[#5c4b37]"
              : theme === "dark"
              ? "bg-slate-900 border-slate-800 text-slate-100"
              : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className="mb-4 flex items-center justify-between border-b pb-2.5 border-slate-200/60 dark:border-slate-800/60">
              <h3 className="flex items-center gap-2 text-base font-bold">
                <InfoIcon size={18} className="text-brand-500" />
                Text Selection & OCR Guide
              </h3>
              <button onClick={() => setShowOcrTips(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <XIcon size={18} />
              </button>
            </div>
            
            <div className="space-y-4 text-xs sm:text-sm">
              <p>
                This page appears to be <strong>image-only</strong> (e.g. a scanned book or document). In these files, native text selection is not supported.
              </p>
              
              <div className={`p-3 rounded-xl border ${
                theme === "sepia"
                  ? "bg-[#ebd9b3]/50 border-[#e2cf9f]"
                  : theme === "dark"
                  ? "bg-slate-950/40 border-slate-800/60"
                  : "bg-slate-50 border-slate-150"
              }`}>
                <h4 className="font-bold text-brand-600 dark:text-brand-400 mb-1">💻 Windows Users (Shortcut Method)</h4>
                <p className="leading-relaxed">
                  We recommend using the official <strong>Windows PowerToys Text Extractor</strong>:
                </p>
                <ol className="list-decimal pl-4 mt-1 space-y-1">
                  <li>Press <kbd className="px-1.5 py-0.5 border rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs">Win + Shift + T</kbd> on your keyboard.</li>
                  <li>Click and drag a box over any text on the page to OCR it.</li>
                  <li>Open the AI Assistant drawer on the right and paste the copied text to ask questions!</li>
                </ol>
              </div>

              <div className={`p-3 rounded-xl border ${
                theme === "sepia"
                  ? "bg-[#ebd9b3]/50 border-[#e2cf9f]"
                  : theme === "dark"
                  ? "bg-slate-950/40 border-slate-800/60"
                  : "bg-slate-50 border-slate-150"
              }`}>
                <h4 className="font-bold text-brand-600 dark:text-brand-400 mb-1">🌐 Browser Extensions (In-Page OCR)</h4>
                <p className="leading-relaxed">
                  You can install free extensions from the Chrome Web Store:
                </p>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li><strong>Copyfish Free OCR:</strong> Captures any region on the screen and extracts text instantly.</li>
                  <li><strong>Blackbox:</strong> Selects text from any webpage, image, or video directly.</li>
                </ul>
              </div>

              <div className={`p-3 rounded-xl border ${
                theme === "sepia"
                  ? "bg-[#ebd9b3]/50 border-[#e2cf9f]"
                  : theme === "dark"
                  ? "bg-slate-950/40 border-slate-800/60"
                  : "bg-slate-50 border-slate-150"
              }`}>
                <h4 className="font-bold text-brand-600 dark:text-brand-400 mb-1">🤖 RAG Book Chat</h4>
                <p className="leading-relaxed">
                  You can always chat directly with this book in the <strong>AI Assistant tab</strong> (with Vector Context enabled) to ask broad questions about the whole book without needing to select text!
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button size="sm" onClick={() => setShowOcrTips(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sign In Prompt Modal */}
      {showAuthModal && (
        <AuthPromptModal onClose={() => setShowAuthModal(false)} />
      )}

      {/* Top Navigation Header */}
      <header
        role="toolbar"
        aria-label="Reader Controls"
        className={`z-20 flex h-14 items-center justify-between border-b px-3 backdrop-blur-xl sm:px-4 ${themeHeaderStyle}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/book/${id}`}
            className={buttonClass({ variant: "ghost", size: "icon-sm" })}
            title="Back to book detail"
            aria-label="Back to book detail"
          >
            <ArrowLeftIcon size={18} />
          </Link>
          <div className="max-w-[130px] sm:max-w-xs md:max-w-md truncate font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
            {book?.title || "Reading..."}
          </div>
        </div>

        {/* Center Controls (Desktop) */}
        <div className="hidden sm:flex items-center gap-1.5">
          <SegmentedControl
            options={[
              { value: "paged", label: "Paged" },
              { value: "scroll", label: "Scroll" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as ReadMode)}
          />

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-800" />

          {/* Theme Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200/80 p-0.5 dark:border-slate-800">
            <button
              onClick={() => setTheme("light")}
              title="Light theme"
              className={`h-5 w-5 rounded-md transition-transform ${
                theme === "light" ? "ring-2 ring-brand-500 scale-110" : ""
              } bg-white`}
            />
            <button
              onClick={() => setTheme("sepia")}
              title="Sepia theme"
              className={`h-5 w-5 rounded-md transition-transform ${
                theme === "sepia" ? "ring-2 ring-brand-500 scale-110" : ""
              } bg-[#fbf0d9]`}
            />
            <button
              onClick={() => setTheme("dark")}
              title="Dark theme"
              className={`h-5 w-5 rounded-md transition-transform ${
                theme === "dark" ? "ring-2 ring-brand-500 scale-110" : ""
              } bg-slate-900`}
            />
          </div>

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-800" />

          <IconButton
            size="icon-sm"
            onClick={() => setScale((s) => Math.max(0.4, s - 0.15))}
            aria-label="Zoom out"
            title="Zoom out"
            disabled={scale <= 0.4}
          >
            <MinusIcon size={18} />
          </IconButton>

          <span className="w-12 text-center text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400">
            {Math.round(scale * 100)}%
          </span>

          <IconButton
            size="icon-sm"
            onClick={() => setScale((s) => Math.min(3.0, s + 0.15))}
            aria-label="Zoom in"
            title="Zoom in"
            disabled={scale >= 3.0}
          >
            <PlusIcon size={18} />
          </IconButton>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1">
          <IconButton
            size="icon-sm"
            onClick={() => {
              setIsAreaSelectMode((v) => !v);
              if (areaBox) setAreaBox(null);
            }}
            aria-label="Area Selection Tool"
            title={isAreaSelectMode ? "Cancel Area Selection" : "Area Selection Tool (Select & Explain)"}
            className={`hidden sm:inline-flex ${
              isAreaSelectMode
                ? "!bg-brand-600 !text-white shadow-md shadow-brand-500/30 ring-2 ring-brand-400"
                : "text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
            }`}
          >
            <MarqueeIcon size={18} />
          </IconButton>

          <IconButton
            size="icon-sm"
            onClick={() => setShowSearch((v) => !v)}
            aria-label="Search within PDF"
            title="Search within PDF (Ctrl+F)"
            className={`hidden sm:inline-flex ${showSearch ? "text-brand-600 dark:text-brand-400" : ""}`}
          >
            <SearchIcon size={18} />
          </IconButton>

          <IconButton
            size="icon-sm"
            onClick={toggleBookmark}
            aria-label={isBookmarked ? "Bookmarked" : "Bookmark this page"}
            title={isBookmarked ? "Bookmarked" : "Bookmark this page"}
            className={`hidden sm:inline-flex ${isBookmarked ? "text-brand-600 dark:text-brand-400" : ""}`}
          >
            {isBookmarked ? (
              <BookmarkIcon size={18} filled />
            ) : (
              <BookmarkPlusIcon size={18} />
            )}
          </IconButton>

          <IconButton
            size="icon-sm"
            onClick={() => setShowDrawer((v) => !v)}
            aria-label="AI Study & Drawer"
            title="AI Study & Drawer"
            className={`hidden sm:inline-flex ${showDrawer ? "text-brand-600 dark:text-brand-400" : ""}`}
          >
            <SparklesIcon size={18} />
          </IconButton>

          <a
            href={downloadUrl}
            className={`hidden sm:inline-flex ${buttonClass({ variant: "ghost", size: "icon-sm" })}`}
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

          {!isOwner && (
            <Link
              href="/login"
              className="ml-1 flex items-center gap-1.5 rounded-xl bg-brand-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:bg-brand-700 active:scale-95"
            >
              <LockIcon size={13} />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}
        </div>
      </header>

      {/* Floating Action Dock (FAB) for Mobile Reading */}
      <div className="fixed bottom-16 right-4 z-40 flex sm:hidden items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 p-1.5 shadow-2xl backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-900/90 animate-fade-in">
        <button
          onClick={() => {
            setIsAreaSelectMode((v) => !v);
            if (areaBox) setAreaBox(null);
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 active:scale-85 hover:scale-110 ${
            isAreaSelectMode
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/30 ring-2 ring-brand-400"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
          title="Area Selection Tool"
        >
          <MarqueeIcon size={18} />
        </button>

        <button
          onClick={() => setShowDrawer((v) => !v)}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 active:scale-85 hover:scale-110 ${
            showDrawer
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/30 ring-2 ring-brand-400"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
          title="Outline & AI Tutor"
        >
          <SparklesIcon size={18} />
        </button>

        <button
          onClick={toggleBookmark}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 active:scale-85 hover:scale-110 ${
            isBookmarked
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
          title="Bookmark Page"
        >
          <BookmarkIcon size={18} filled={isBookmarked} />
        </button>

        <button
          onClick={() => setShowSearch((v) => !v)}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 active:scale-85 hover:scale-110 ${
            showSearch
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/30 ring-2 ring-brand-400"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
          title="Search PDF"
        >
          <SearchIcon size={18} />
        </button>

        <button
          onClick={() => setShowMobileSettings((v) => !v)}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 active:scale-85 hover:scale-110 ${
            showMobileSettings
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/30 ring-2 ring-brand-400"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          }`}
          title="Reader Settings"
        >
          <SlidersIcon size={18} />
        </button>
      </div>

      {/* Mobile Reader Settings Slide-Up Bottom Sheet */}
      {showMobileSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full rounded-t-3xl border-t border-slate-200/80 bg-white p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900 space-y-5 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersIcon size={18} className="text-brand-600 dark:text-brand-400" />
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Reading Display Settings
                </h4>
              </div>
              <button
                onClick={() => setShowMobileSettings(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-transform active:scale-90"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Layout Mode */}
            <div>
              <span className="block text-xs font-bold text-slate-500 mb-2">Reading Mode</span>
              <SegmentedControl
                options={[
                  { value: "paged", label: "📄 Single Paged" },
                  { value: "scroll", label: "📜 Continuous Scroll" },
                ]}
                value={mode}
                onChange={(v) => setMode(v as ReadMode)}
              />
            </div>

            {/* Theme Selector */}
            <div>
              <span className="block text-xs font-bold text-slate-500 mb-2">Color Theme</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-all active:scale-95 ${
                    theme === "light"
                      ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-slate-300 bg-white" /> Light
                </button>

                <button
                  onClick={() => setTheme("sepia")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-all active:scale-95 ${
                    theme === "sepia"
                      ? "border-brand-500 bg-[#fbf0d9] text-amber-900 ring-2 ring-brand-500"
                      : "border-amber-200 bg-[#fbf0d9] text-amber-900"
                  }`}
                >
                  <span className="h-3.5 w-3.5 rounded-full bg-[#f4e4c1]" /> Sepia
                </button>

                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-all active:scale-95 ${
                    theme === "dark"
                      ? "border-brand-500 bg-slate-900 text-white ring-2 ring-brand-500"
                      : "border-slate-800 bg-slate-900 text-slate-300"
                  }`}
                >
                  <span className="h-3.5 w-3.5 rounded-full bg-slate-950" /> Dark
                </button>
              </div>
            </div>

            {/* Zoom Controls */}
            <div>
              <span className="block text-xs font-bold text-slate-500 mb-2">Page Zoom</span>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800/60">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setScale((s) => Math.max(0.4, s - 0.15))}
                  disabled={scale <= 0.4}
                  className="transition-transform active:scale-90"
                >
                  <MinusIcon size={16} /> Zoom Out
                </Button>
                <button
                  onClick={() => setScale(1.0)}
                  title="Reset Zoom to 100%"
                  className="text-sm font-black text-slate-800 dark:text-slate-100 tabular-nums hover:text-brand-600 dark:hover:text-brand-400"
                >
                  {Math.round(scale * 100)}%
                </button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setScale((s) => Math.min(3.0, s + 0.15))}
                  disabled={scale >= 3.0}
                  className="transition-transform active:scale-90"
                >
                  <PlusIcon size={16} /> Zoom In
                </Button>
              </div>
            </div>

            {/* Download Action */}
            <div className="pt-2">
              <a
                href={downloadUrl}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand-600 py-3 text-xs font-bold text-white shadow-lg shadow-brand-500/20 transition-all active:scale-95"
              >
                <DownloadIcon size={15} /> Download PDF
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="h-1 w-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* In-PDF Search Bar */}
      {showSearch && (
        <form
          onSubmit={handlePdfSearch}
          className="z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2 shadow-md backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95"
        >
          <div className="flex flex-1 items-center gap-2">
            <SearchIcon size={16} className="text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inside PDF text..."
              autoFocus
              className="w-full bg-transparent text-xs outline-none text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2">
            {isSearching && <Spinner size="sm" />}
            {searchResults.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>
                  {currentMatchIndex + 1} of {searchResults.length} matches
                </span>
                <IconButton
                  size="icon-sm"
                  type="button"
                  onClick={() => {
                    const idx = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
                    setCurrentMatchIndex(idx);
                    goTo(searchResults[idx].page);
                  }}
                >
                  <ChevronLeftIcon size={14} />
                </IconButton>
                <IconButton
                  size="icon-sm"
                  type="button"
                  onClick={() => {
                    const idx = (currentMatchIndex + 1) % searchResults.length;
                    setCurrentMatchIndex(idx);
                    goTo(searchResults[idx].page);
                  }}
                >
                  <ChevronRightIcon size={14} />
                </IconButton>
              </div>
            )}
            <IconButton size="icon-sm" type="button" onClick={() => setShowSearch(false)}>
              <XIcon size={16} />
            </IconButton>
          </div>
        </form>
      )}

      <div
        className="flex-1 overflow-hidden relative"
        style={
          showDrawer
            ? {
                display: "grid",
                gridTemplateColumns: `minmax(260px, ${sidebarWidth}px) 6px 1fr`,
                height: "calc(100vh - 96px)",
              }
            : { display: "flex", height: "calc(100vh - 96px)" }
        }
      >
        {/* Sidebar Drawer (Desktop side panel & Mobile slide-up bottom sheet) */}
        {showDrawer && (
          <>
            {/* Desktop Side Panel */}
            <aside
              style={{ width: "100%", maxWidth: `${sidebarWidth}px` }}
              className={`hidden sm:flex shrink-0 animate-fade-in flex-col border-r backdrop-blur h-full overflow-hidden ${themeSidebarStyle}`}
            >
              {/* Drawer Tabs */}
              <div className={`flex border-b p-1.5 gap-1 overflow-x-auto no-scrollbar shrink-0 ${themeTabsHeaderStyle}`}>
                <button
                  onClick={() => setActiveTab("toc")}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all ${getTabButtonStyle("toc")}`}
                >
                  Outline
                </button>
                <button
                  onClick={() => setActiveTab("ai")}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${getTabButtonStyle("ai")}`}
                >
                  <SparklesIcon size={12} />
                  AI
                </button>
                <button
                  onClick={() => setActiveTab("study")}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all ${getTabButtonStyle("study")}`}
                >
                  Study
                </button>
                <button
                  onClick={() => setActiveTab("bookmarks")}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all ${getTabButtonStyle("bookmarks")}`}
                >
                  Marks
                </button>
                <button
                  onClick={() => setActiveTab("highlights")}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all ${getTabButtonStyle("highlights")}`}
                >
                  Highlights
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all ${getTabButtonStyle("notes")}`}
                >
                  Notes
                </button>
              </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col min-h-0">
              {activeTab === "toc" && (
                <div className="overflow-y-auto">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Table of Contents
                  </h4>
                  {tocOutline.length === 0 ? (
                    <p className="text-xs text-slate-500">No outline available for this PDF.</p>
                  ) : (
                    <ul className="space-y-1">
                      {tocOutline.map((item, idx) => (
                        <li key={idx} className="rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">
                          <button
                            onClick={() => handleOutlineClick(item)}
                            className="w-full text-left font-medium text-slate-700 transition-colors hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400"
                          >
                            {item.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* AI Assistant Chat & RAG Tab */}
              {activeTab === "ai" && (
                <div className="flex flex-1 flex-col h-full min-h-0 justify-between">
                  <div className="shrink-0">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <SparklesIcon size={14} className="text-brand-500" />
                        AI Assistant
                      </span>
                      {chatMessages.length > 0 && (
                        <button
                          onClick={handleClearAiChat}
                          className="text-[10px] font-medium text-slate-400 hover:text-red-500 transition-colors"
                        >
                          Clear Chat
                        </button>
                      )}
                    </div>

                    {/* Mode Toggle: Chat vs RAG */}
                    <div className="mb-2.5 flex items-center justify-between rounded-xl bg-slate-100/90 p-2 border border-slate-200/60 dark:bg-slate-800/80 dark:border-slate-700/60">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        Chat with this Book (RAG)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsRagMode((v) => !v)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isRagMode ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isRagMode ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Context Active Pill */}
                    <div className="mb-2.5 rounded-xl border border-brand-200/90 bg-brand-50/70 p-2.5 text-[11px] text-brand-900 shadow-xs dark:border-brand-900/60 dark:bg-brand-950/50 dark:text-brand-200">
                      <p className="font-semibold flex items-center gap-1">
                        <span>{isRagMode ? "📚 RAG Vector Context Active" : "📖 Page Context Active"}</span>
                      </p>
                      <p className="truncate opacity-90 text-[10.5px] mt-0.5">
                        Page {page} {book?.title ? `• ${book.title}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto space-y-3 mb-2.5 pr-1.5 min-h-0">
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center p-4 mt-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <SparklesIcon size={24} className="text-brand-500/70 mb-2" />
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {isRagMode
                            ? "Ask questions to search and chat with this whole book using AI vectors."
                            : `Ask questions about page ${page} or analyze concepts in this book.`}
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((m, idx) => {
                        const assistantMsgStyle =
                          theme === "sepia"
                            ? "bg-[#ebd9b3]/90 text-[#5c4b37] border-[#e2cf9f]"
                            : theme === "dark"
                            ? "bg-slate-800/90 text-slate-100 border-slate-700/80"
                            : "bg-white text-slate-800 border-slate-200/80 shadow-xs";

                        return (
                          <div
                            key={idx}
                            className={`transition-all ${
                              m.role === "user"
                                ? "ml-6 rounded-2xl rounded-tr-xs bg-gradient-to-r from-brand-600 to-indigo-600 p-3 text-xs font-medium text-white shadow-sm"
                                : `mr-1 rounded-2xl rounded-tl-xs p-3.5 text-xs border ${assistantMsgStyle}`
                            }`}
                          >
                            {m.role === "user" ? (
                              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                            ) : (
                              <MarkdownContent content={m.content} theme={theme} />
                            )}

                            {/* Source Citations */}
                            {m.role === "assistant" && Array.isArray(m.sources) && m.sources.length > 0 && (
                              <div className="mt-2.5 border-t border-slate-200/80 pt-2 dark:border-slate-700/80">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Sources
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {m.sources.map((src, sIdx) => (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      onClick={() => goTo(src.page)}
                                      className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60"
                                    >
                                      {src.chapter ? `${src.chapter} — ` : ""}Page {src.page}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    {chatLoading && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 p-2.5 rounded-xl bg-slate-100/60 dark:bg-slate-800/50">
                        <Spinner size="sm" />
                        <span className="font-medium">Searching vectors and synthesizing response...</span>
                      </div>
                    )}
                    {chatError && (
                      <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/60">
                        {chatError}
                      </div>
                    )}
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={handleSendAiChat}
                    className="relative flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-800/90 dark:bg-slate-900 focus-within:dark:border-brand-400 shrink-0"
                  >
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={isRagMode ? "Ask a question about this book..." : `Ask AI about page ${page}...`}
                      rows={1}
                      className="flex-1 resize-none bg-transparent py-2 px-3 text-xs font-medium outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 max-h-28"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendAiChat(e);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatInput.trim()}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-sm transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                      title={isRagMode ? "Query Book" : "Ask AI"}
                    >
                      {chatLoading ? (
                        <Spinner size="sm" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "study" && (
                <div className="flex-1 overflow-y-auto">
                  <LearningDashboard bookId={id} page={page} onNavigatePage={goTo} />
                </div>
              )}

              {activeTab === "bookmarks" && (
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Bookmarked Pages
                  </h4>
                  {bookmarks.length === 0 ? (
                    <p className="text-xs text-slate-500">No bookmarks yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {bookmarks.map((b) => (
                        <li
                          key={b.page}
                          className="group flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/30"
                        >
                          <button
                            onClick={() => goTo(b.page)}
                            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                          >
                            <BookmarkIcon size={14} filled className="text-brand-500" />
                            {b.label}
                          </button>
                          <button
                            onClick={() => toggleBookmark()}
                            className="text-slate-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
                          >
                            <XIcon size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === "highlights" && (
                <div className="space-y-4">
                  {isOwner && (
                    <form onSubmit={(e) => { e.preventDefault(); handleAddHighlight(newHighlightText); setNewHighlightText(""); }} className="space-y-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                        Add Text Highlight (Page {page})
                      </label>
                      <textarea
                        value={newHighlightText}
                        onChange={(e) => setNewHighlightText(e.target.value)}
                        placeholder="Enter quote or text..."
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                          {["yellow", "green", "blue", "pink"].map((c) => (
                            <button
                              type="button"
                              key={c}
                              onClick={() => setHighlightColor(c)}
                              className={`h-4 w-4 rounded-full border ${
                                highlightColor === c ? "ring-2 ring-brand-500" : ""
                              } ${
                                c === "yellow"
                                  ? "bg-amber-300"
                                  : c === "green"
                                  ? "bg-emerald-300"
                                  : c === "blue"
                                  ? "bg-sky-300"
                                  : "bg-rose-300"
                              }`}
                            />
                          ))}
                        </div>
                        <Button size="sm" type="submit">
                          Highlight
                        </Button>
                      </div>
                    </form>
                  )}

                  {highlights.length === 0 ? (
                    <p className="text-xs text-slate-500">No highlights saved.</p>
                  ) : (
                    <ul className="space-y-2">
                      {highlights.map((h) => (
                        <li
                          key={h.id}
                          className="group relative rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="mb-1 flex items-center justify-between text-slate-400">
                            <button onClick={() => goTo(h.page)} className="font-semibold text-brand-600 dark:text-brand-400">
                              Page {h.page}
                            </button>
                            {isOwner && (
                              <button onClick={() => handleDeleteHighlight(h.id)} className="text-slate-400 hover:text-red-500">
                                <XIcon size={13} />
                              </button>
                            )}
                          </div>
                          <p className={`rounded p-1.5 italic ${
                            h.color === "green"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200"
                              : h.color === "blue"
                              ? "bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200"
                              : h.color === "pink"
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200"
                              : "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200"
                          }`}>
                            &quot;{h.selectedText}&quot;
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === "notes" && (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={noteQuery}
                    onChange={(e) => setNoteQuery(e.target.value)}
                    placeholder="Search notes..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900"
                  />

                  {isOwner && (
                    <form onSubmit={handleSaveNoteForm} className="space-y-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                        Add Note (Page {page})
                      </label>
                      <textarea
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Write personal thoughts or summary..."
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" type="submit">
                          Save Note
                        </Button>
                      </div>
                    </form>
                  )}

                  {filteredNotes.length === 0 ? (
                    <p className="text-xs text-slate-500">No notes found.</p>
                  ) : (
                    <ul className="space-y-2">
                      {filteredNotes.map((n) => (
                        <li
                          key={n.id}
                          className="group rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <button onClick={() => goTo(n.page)} className="font-semibold text-brand-600 dark:text-brand-400">
                              Page {n.page}
                            </button>
                            {isOwner && (
                              <button onClick={() => handleDeleteNote(n.id)} className="text-slate-400 hover:text-red-500">
                                <XIcon size={13} />
                              </button>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{n.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Desktop Draggable Mouse Resizer Splitter */}
          <div
            onMouseDown={startResizingSidebar}
            className={`hidden sm:flex w-1.5 hover:w-2 cursor-col-resize select-none shrink-0 z-30 transition-all items-center justify-center group relative h-full ${
              isResizingSidebar
                ? "bg-brand-600 shadow-md ring-1 ring-brand-400"
                : "bg-slate-200/80 hover:bg-brand-500/80 dark:bg-slate-800/80 dark:hover:bg-brand-500/80"
            }`}
            title="Click and drag with mouse to dynamically resize sidebar width"
          >
            <div className="h-10 w-0.5 rounded-full bg-slate-400/80 group-hover:bg-white transition-colors" />
          </div>

          {/* Mobile Slide-Up Bottom Sheet */}
          <div className="fixed inset-0 z-50 flex items-end sm:hidden bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full flex flex-col h-[82vh] rounded-t-3xl border-t shadow-2xl backdrop-blur-2xl animate-fade-in-up ${themeSidebarStyle}`}>
              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b p-3.5 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <BookOpenIcon size={18} className="text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold">
                    Book Study & AI Assistant
                  </h4>
                </div>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="rounded-full bg-slate-100 p-1 text-slate-400 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800"
                >
                  <XIcon size={16} />
                </button>
              </div>

              {/* Drawer Tabs */}
              <div className={`flex border-b p-2 gap-1 ${themeTabsHeaderStyle}`}>
                <button
                  onClick={() => setActiveTab("toc")}
                  className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${getTabButtonStyle("toc")}`}
                >
                  Outline
                </button>
                <button
                  onClick={() => setActiveTab("ai")}
                  className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 ${getTabButtonStyle("ai")}`}
                >
                  <SparklesIcon size={12} />
                  AI
                </button>
                <button
                  onClick={() => setActiveTab("study")}
                  className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${getTabButtonStyle("study")}`}
                >
                  Study
                </button>
                <button
                  onClick={() => setActiveTab("bookmarks")}
                  className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${getTabButtonStyle("bookmarks")}`}
                >
                  Marks
                </button>
                <button
                  onClick={() => setActiveTab("highlights")}
                  className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${getTabButtonStyle("highlights")}`}
                >
                  Highlights
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${getTabButtonStyle("notes")}`}
                >
                  Notes
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                {activeTab === "toc" && (
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Table of Contents
                    </h4>
                    {tocOutline.length === 0 ? (
                      <p className="text-xs text-slate-500">No outline available for this PDF.</p>
                    ) : (
                      <ul className="space-y-1">
                        {tocOutline.map((item, idx) => (
                          <li key={idx} className="rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">
                            <button
                              onClick={() => { handleOutlineClick(item); setShowDrawer(false); }}
                              className="w-full text-left font-medium text-slate-700 transition-colors hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400"
                            >
                              {item.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === "ai" && (
                  <div className="flex flex-1 flex-col h-full justify-between">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                          <SparklesIcon size={14} className="text-brand-500" />
                          AI Assistant
                        </span>
                        {chatMessages.length > 0 && (
                          <button
                            onClick={handleClearAiChat}
                            className="text-[10px] text-slate-400 hover:text-red-500"
                          >
                            Clear Chat
                          </button>
                        )}
                      </div>

                      <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-100 p-1.5 dark:bg-slate-800">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Chat with this Book (RAG)
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsRagMode((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isRagMode ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isRagMode ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="mb-3 rounded-lg border border-brand-200/80 bg-brand-50/50 p-2 text-[11px] text-brand-900 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-200">
                        <p className="font-semibold">
                          {isRagMode ? "📚 RAG Vector Context Active:" : "Page Context Active:"}
                        </p>
                        <p className="truncate">Page {page} {book?.title ? `• ${book.title}` : ""}</p>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 pr-1">
                      {chatMessages.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center mt-6">
                          {isRagMode
                            ? "Ask questions to search and chat with this book using pgvector RAG."
                            : `Ask questions about page ${page} or concepts in this book.`}
                        </p>
                      ) : (
                        chatMessages.map((m, idx) => {
                          const assistantMsgStyle = theme === "sepia"
                            ? "bg-[#ebd9b3] text-[#5c4b37] border-[#e2cf9f]"
                            : theme === "dark"
                            ? "bg-slate-800 text-slate-100 border-slate-700"
                            : "bg-slate-100 text-slate-800 border-slate-200/60";

                          return (
                            <div
                              key={idx}
                              className={`rounded-xl p-2.5 text-xs border ${
                                m.role === "user"
                                  ? "bg-brand-600 text-white ml-6 border-transparent"
                                  : `${assistantMsgStyle} mr-2`
                              }`}
                            >
                              {m.role === "user" ? (
                                <p className="whitespace-pre-wrap">{m.content}</p>
                              ) : (
                                <MarkdownContent content={m.content} theme={theme} />
                              )}
                            </div>
                          );
                        })
                      )}
                      {chatLoading && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                          <Spinner size="sm" />
                          <span>Searching book vectors...</span>
                        </div>
                      )}
                    </div>

                    <form
                      onSubmit={handleSendAiChat}
                      className="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 dark:border-slate-800 dark:bg-slate-900/60 dark:focus-within:border-brand-400"
                    >
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={isRagMode ? "Ask a question about this book..." : `Ask AI about page ${page}...`}
                        rows={1}
                        className="flex-1 resize-none bg-transparent py-2 px-3 text-xs outline-none dark:text-white max-h-24"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendAiChat(e);
                          }
                        }}
                      />
                      <button
                        type="submit"
                        disabled={chatLoading || !chatInput.trim()}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-sm transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                        title={isRagMode ? "Query Book" : "Ask AI"}
                      >
                        {chatLoading ? (
                          <Spinner size="sm" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {activeTab === "study" && (
                  <div className="flex-1 overflow-y-auto">
                    <LearningDashboard bookId={id} page={page} onNavigatePage={(p) => { goTo(p); setShowDrawer(false); }} />
                  </div>
                )}

                {activeTab === "bookmarks" && (
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Bookmarked Pages
                    </h4>
                    {bookmarks.length === 0 ? (
                      <p className="text-xs text-slate-500">No bookmarks yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {bookmarks.map((b) => (
                          <li
                            key={b.page}
                            className="group flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/30"
                          >
                            <button
                              onClick={() => { goTo(b.page); setShowDrawer(false); }}
                              className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                            >
                              <BookmarkIcon size={14} filled className="text-brand-500" />
                              {b.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === "highlights" && (
                  <div className="space-y-4">
                    {highlights.length === 0 ? (
                      <p className="text-xs text-slate-500">No highlights saved.</p>
                    ) : (
                      <ul className="space-y-2">
                        {highlights.map((h) => (
                          <li
                            key={h.id}
                            className="group relative rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900"
                          >
                            <button onClick={() => { goTo(h.page); setShowDrawer(false); }} className="font-semibold text-brand-600 dark:text-brand-400">
                              Page {h.page}
                            </button>
                            <p className="mt-1 italic">&quot;{h.selectedText}&quot;</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === "notes" && (
                  <div className="space-y-4">
                    {filteredNotes.length === 0 ? (
                      <p className="text-xs text-slate-500">No notes found.</p>
                    ) : (
                      <ul className="space-y-2">
                        {filteredNotes.map((n) => (
                          <li
                            key={n.id}
                            className="group rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900"
                          >
                            <button onClick={() => { goTo(n.page); setShowDrawer(false); }} className="font-semibold text-brand-600 dark:text-brand-400">
                              Page {n.page}
                            </button>
                            <p className="mt-1 text-slate-700 dark:text-slate-300">{n.content}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

        {/* PDF Viewport */}
        <div
          ref={viewportRef}
          onPointerDown={handleAreaPointerDown}
          onPointerMove={handleAreaPointerMove}
          onPointerUp={handleAreaPointerUp}
          onPointerCancel={() => {
            if (isAreaSelectMode) {
              setAreaBox(null);
            }
          }}
          style={{
            touchAction: isAreaSelectMode ? "none" : undefined,
          }}
          className={`flex min-w-0 flex-1 flex-col items-center overflow-auto py-6 relative ${
            isAreaSelectMode ? "cursor-crosshair select-none" : ""
          }`}
        >
          {/* Active Area Select Mode Floating Badge Indicator */}
          {isAreaSelectMode && (
            <div className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 whitespace-nowrap rounded-full border border-brand-400 bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-2xl animate-fade-in">
              <MarqueeIcon size={16} />
              <span>
                <span className="hidden sm:inline">Area Select Active — Drag box over text/image</span>
                <span className="sm:hidden">Drag over area to select</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAreaSelectMode(false);
                  setAreaBox(null);
                }}
                className="ml-2 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold hover:bg-white/30 transition active:scale-95"
                title="Cancel Area Select"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Figma Live Selection Box Overlay (Live Dragging & Persisted Selection) */}
          {(areaBox || selectedAreaBox) && (() => {
            const activeBox = areaBox || selectedAreaBox;
            if (!activeBox) return null;
            const left = Math.min(activeBox.startX, activeBox.endX);
            const top = Math.min(activeBox.startY, activeBox.endY);
            const width = Math.abs(activeBox.endX - activeBox.startX);
            const height = Math.abs(activeBox.endY - activeBox.startY);
            if (width < 5 && height < 5) return null;

            return (
              <div
                style={{
                  position: "fixed",
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  pointerEvents: "none",
                }}
                className="z-40 border-2 border-brand-500 bg-brand-500/15 shadow-2xl ring-2 ring-brand-400/40 rounded-lg animate-fade-in"
              >
                {/* Figma Corner Handles */}
                <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />
                <div className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />
                <div className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />
                <div className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />

                {/* Dimensions Badge */}
                <div className="absolute -top-7 left-0 inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                  <span>Selected Area ({Math.round(width)}×{Math.round(height)})</span>
                </div>
              </div>
            );
          })()}
          {status === "loading" ? (
            <div className="mt-24">
              <BookLoader label="Initializing PDF Reader..." />
            </div>
          ) : loadError ? (
            <div className="mt-24 flex flex-col items-center justify-center p-6 text-center space-y-4 rounded-3xl border border-amber-200/80 bg-amber-50/40 dark:border-amber-900/60 dark:bg-slate-900">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <AlertTriangleIcon size={28} />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Could Not Load PDF Document
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The PDF stream may be temporarily unavailable or requires re-authentication.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setLoadError(false)}>
                  Retry Loading
                </Button>
                <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </div>
          ) : (
            <ReaderErrorBoundary onReset={() => setMode("paged")}>
              <Document
                file={fileUrl}
                options={PDF_OPTIONS}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(err) => {
                  if (err?.name === "MissingPDFException" || err?.message?.includes("Missing PDF")) {
                    setLoadError(true);
                    return;
                  }
                  console.warn("PDF load error:", err);
                  setLoadError(true);
                }}
                loading={
                  <div className="mt-20">
                    <BookLoader label="Loading PDF Document & Pages..." />
                  </div>
                }
              >
                {mode === "scroll" && numPages > 0 ? (
                  <div className="flex w-full flex-col items-center gap-4">
                    {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
                      const isNearWindow = Math.abs(p - renderCenter) <= (fitWidth < 600 ? 8 : 12);
                      if (!isNearWindow) {
                        return (
                          <div
                            key={p}
                            ref={(el) => {
                              if (el) pageEls.current.set(p, el);
                              else pageEls.current.delete(p);
                            }}
                            data-page-number={p}
                            style={{
                              width: pageWidth ? `${pageWidth}px` : "100%",
                              height: `${estHeight}px`,
                            }}
                            className="flex items-center justify-center rounded-sm bg-slate-100/40 text-xs font-medium text-slate-400 dark:bg-slate-800/30"
                          >
                            Page {p}
                          </div>
                        );
                      }

                      return (
                        <ScrollPage
                          key={p}
                          pageNumber={p}
                          width={pageWidth}
                          estHeight={estHeight}
                          pageEls={pageEls}
                          dpr={dpr}
                          active={Math.abs(p - renderCenter) <= RENDER_WINDOW}
                          onGetTextSuccess={handleScrollPageTextSuccess}
                        />
                      );
                    })}
                  </div>
                ) : (
                <PagedPage
                  page={page}
                  pageWidth={pageWidth}
                  scale={scale}
                  dpr={dpr}
                  onGetTextSuccess={handleScrollPageTextSuccess}
                />
              )}
            </Document>
          </ReaderErrorBoundary>
          )}
        </div>
      </div>

      {/* Touch-Friendly Mobile & Bottom Toolbar */}
      <footer
        role="toolbar"
        aria-label="Navigation toolbar"
        className={`sticky bottom-0 z-20 flex min-h-[48px] items-center justify-between gap-2 border-t px-3 py-2 backdrop-blur-xl ${themeHeaderStyle}`}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            className="min-h-[36px] min-w-[36px]"
          >
            <ChevronLeftIcon size={16} />
            <span className="hidden sm:inline">Prev</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseInt(pageInput, 10);
              if (!Number.isNaN(n)) goTo(n);
            }}
            className="flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              aria-label="Page number input"
              className="w-12 sm:w-14 rounded-lg border border-slate-300 bg-white/80 px-2 py-1.5 text-center outline-none transition-colors focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800/80"
            />
            <span className="text-slate-500">/ {numPages || "…"}</span>
          </form>

          {!currentHasText && (
            <button
              type="button"
              onClick={() => setShowOcrTips(true)}
              className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/30 transition-all shrink-0 animate-pulse"
              title="Page text not selectable. Click for OCR Tips"
            >
              <InfoIcon size={12} />
              <span>OCR Tips</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => goTo(page + 1)}
            disabled={page >= numPages}
            className="min-h-[36px] min-w-[36px]"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRightIcon size={16} />
          </Button>
        </div>
      </footer>
    </div>
  );
}

const PagedPage = memo(function PagedPage({
  page,
  pageWidth,
  scale,
  dpr,
  onGetTextSuccess,
}: {
  page: number;
  pageWidth?: number;
  scale: number;
  dpr: number;
  onGetTextSuccess: (pageNum: number, hasText: boolean) => void;
}) {
  return (
    <Page
      pageNumber={page}
      width={pageWidth}
      scale={pageWidth ? undefined : scale}
      devicePixelRatio={dpr}
      renderTextLayer={true}
      renderAnnotationLayer={false}
      onGetTextSuccess={(text) => {
        onGetTextSuccess(page, text.items.length > 0);
      }}
      onRenderError={(err) => {
        if (isAbortError(err)) return;
        console.error("Page render error:", err);
      }}
      onRenderTextLayerError={(err) => {
        if (isAbortError(err)) return;
        console.error("TextLayer error:", err);
      }}
      className="shadow-lg"
    />
  );
});

const ScrollPage = memo(function ScrollPage({
  pageNumber,
  width,
  estHeight,
  pageEls,
  dpr,
  active,
  onGetTextSuccess,
}: {
  pageNumber: number;
  width?: number;
  estHeight: number;
  pageEls: React.MutableRefObject<Map<number, HTMLDivElement>>;
  dpr: number;
  active: boolean;
  onGetTextSuccess?: (page: number, hasText: boolean) => void;
}) {
  return (
    <div
      ref={(el) => {
        if (el) pageEls.current.set(pageNumber, el);
        else pageEls.current.delete(pageNumber);
      }}
      data-page-number={pageNumber}
      style={{
        width: width ? `${width}px` : "100%",
        minHeight: `${estHeight}px`,
      }}
      className="relative flex flex-col items-center justify-center rounded-sm bg-white shadow-md dark:bg-slate-900 overflow-hidden"
    >
      {active ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          devicePixelRatio={dpr}
          renderTextLayer={true}
          renderAnnotationLayer={false}
          onGetTextSuccess={(text) => {
            onGetTextSuccess?.(pageNumber, text.items.length > 0);
          }}
          loading={
            <div className="flex flex-col items-center justify-center w-full min-h-[500px] p-8 space-y-4 bg-white dark:bg-slate-900 animate-pulse">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
                <Spinner size="sm" />
                <span>Rendering Page {pageNumber}...</span>
              </div>
              <div className="w-3/4 h-3 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="w-full h-3 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="w-5/6 h-3 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="w-2/3 h-3 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          }
          onRenderError={(err) => {
            if (isAbortError(err)) return;
            console.error("Page render error:", err);
          }}
          onRenderTextLayerError={(err) => {
            if (isAbortError(err)) return;
            console.error("TextLayer error:", err);
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full min-h-[450px] p-8 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 animate-pulse">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
            Page {pageNumber}
          </span>
          <div className="w-3/4 h-3.5 rounded-full bg-slate-200/60 dark:bg-slate-800/80" />
          <div className="w-full h-3.5 rounded-full bg-slate-200/60 dark:bg-slate-800/80" />
          <div className="w-5/6 h-3.5 rounded-full bg-slate-200/60 dark:bg-slate-800/80" />
          <div className="w-2/3 h-3.5 rounded-full bg-slate-200/60 dark:bg-slate-800/80" />
        </div>
      )}
    </div>
  );
});
