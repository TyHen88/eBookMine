"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { BookMeta } from "@/lib/types";
import { BookmarkData, HighlightData, NoteData } from "@/lib/readingService";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  page?: number;
  selectedText?: string;
  citations?: string[];
  timestamp: string;
}

export interface DocumentTab {
  id: string; // bookId or driveFileId
  title: string;
  author: string;
  fileName: string;
  cover: string | null;
  pageCount: number;
  currentPage: number;
  scrollOffset: number;
  scale: number;
  fitWidth: boolean;
  theme: "light" | "dark" | "sepia";
  bookmarks: BookmarkData[];
  highlights: HighlightData[];
  notes: NoteData[];
  chatHistory: ChatMessage[];
}

interface ReaderTabContextValue {
  tabs: DocumentTab[];
  activeTabId: string | null;
  activeTab: DocumentTab | null;
  openTab: (book: Partial<BookMeta> & { id: string; title?: string }, switchNow?: boolean) => void;
  closeTab: (tabId: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  setActiveTabId: (tabId: string) => void;
  updateTab: (tabId: string, patch: Partial<DocumentTab> | ((prev: DocumentTab) => Partial<DocumentTab>)) => void;
  updateActiveTab: (patch: Partial<DocumentTab> | ((prev: DocumentTab) => Partial<DocumentTab>)) => void;
  quickPickerOpen: boolean;
  setQuickPickerOpen: (open: boolean) => void;
}

const ReaderTabContext = createContext<ReaderTabContextValue | null>(null);

const STORAGE_KEY_TABS = "ebookmine_reader_tabs_v2";
const STORAGE_KEY_ACTIVE = "ebookmine_reader_active_tab_v2";

function getCurrentAppTheme(): "light" | "dark" | "sepia" {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem("ebookmine-theme");
    if (stored === "dark" || stored === "light") return stored;
    if (document.documentElement.classList.contains("dark")) return "dark";
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    /* fallback */
  }
  return "light";
}

function createInitialTab(id: string): DocumentTab {
  return {
    id,
    title: "Loading Document...",
    author: "Unknown",
    fileName: `${id}.pdf`,
    cover: null,
    pageCount: 0,
    currentPage: 1,
    scrollOffset: 0,
    scale: 1.0,
    fitWidth: true,
    theme: getCurrentAppTheme(),
    bookmarks: [],
    highlights: [],
    notes: [],
    chatHistory: [],
  };
}

export function ReaderTabProvider({
  children,
  initialBookId,
}: {
  children: React.ReactNode;
  initialBookId?: string;
}) {
  // Lazy state initialization to read from localStorage without cascading effect re-renders
  const [tabs, setTabs] = useState<DocumentTab[]>(() => {
    if (typeof window === "undefined") {
      return initialBookId ? [createInitialTab(initialBookId)] : [];
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY_TABS);
      let parsed: DocumentTab[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) parsed = [];

      if (initialBookId && !parsed.some((t) => t.id === initialBookId)) {
        parsed.push(createInitialTab(initialBookId));
      }
      return parsed;
    } catch {
      return initialBookId ? [createInitialTab(initialBookId)] : [];
    }
  });

  const [activeTabId, setActiveTabIdState] = useState<string | null>(() => {
    if (initialBookId) return initialBookId;
    if (typeof window === "undefined") return null;

    try {
      const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
      const raw = localStorage.getItem(STORAGE_KEY_TABS);
      const parsed: DocumentTab[] = raw ? JSON.parse(raw) : [];

      if (savedActive && parsed.some((t) => t.id === savedActive)) {
        return savedActive;
      }
      return parsed.length > 0 ? parsed[0].id : null;
    } catch {
      return null;
    }
  });

  const [quickPickerOpen, setQuickPickerOpen] = useState(false);

  // Persist tabs to localStorage whenever tabs or activeTabId change
  useEffect(() => {
    try {
      const serialized = tabs.map((t) => ({
        id: t.id,
        title: t.title,
        author: t.author,
        fileName: t.fileName,
        cover: t.cover,
        pageCount: t.pageCount,
        currentPage: t.currentPage,
        scrollOffset: t.scrollOffset,
        scale: t.scale,
        fitWidth: t.fitWidth,
        theme: t.theme,
        bookmarks: (t.bookmarks || []).slice(0, 50),
        highlights: (t.highlights || []).slice(0, 100),
        notes: (t.notes || []).slice(0, 50),
        chatHistory: (t.chatHistory || []).slice(-20),
      }));
      localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(serialized));
      if (activeTabId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE, activeTabId);
      }
    } catch {
      /* quota exceeded guard */
    }
  }, [tabs, activeTabId]);

  const openTab = useCallback(
    (book: Partial<BookMeta> & { id: string; title?: string }, switchNow = true) => {
      setTabs((prev) => {
        const existingIdx = prev.findIndex((t) => t.id === book.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            title: book.title || updated[existingIdx].title,
            author: book.author || updated[existingIdx].author,
            cover: book.cover ?? updated[existingIdx].cover,
            pageCount: book.pageCount || updated[existingIdx].pageCount,
          };
          return updated;
        }

        const newTab: DocumentTab = {
          id: book.id,
          title: book.title || "Untitled Book",
          author: book.author || "Unknown",
          fileName: book.fileName || `${book.title || book.id}.pdf`,
          cover: book.cover || null,
          pageCount: book.pageCount || 0,
          currentPage: book.lastPage || 1,
          scrollOffset: 0,
          scale: 1.0,
          fitWidth: true,
          theme: getCurrentAppTheme(),
          bookmarks: (book.bookmarks || []).map((b, idx) => ({
            id: `bm-${idx}`,
            page: b.page,
            title: b.label || `Page ${b.page}`,
            createdAt: b.createdAt || new Date().toISOString(),
          })),
          highlights: [],
          notes: [],
          chatHistory: [],
        };
        return [...prev, newTab];
      });

      if (switchNow) {
        setActiveTabIdState(book.id);
      }
    },
    []
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          const nextActive = filtered.length > 0 ? filtered[filtered.length - 1].id : null;
          setActiveTabIdState(nextActive);
        }
        return filtered;
      });
    },
    [activeTabId]
  );

  const setActiveTabId = useCallback((tabId: string) => {
    setActiveTabIdState(tabId);
  }, []);

  const updateTab = useCallback(
    (
      tabId: string,
      patch: Partial<DocumentTab> | ((prev: DocumentTab) => Partial<DocumentTab>)
    ) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;
          const updates = typeof patch === "function" ? patch(t) : patch;
          return { ...t, ...updates };
        })
      );
    },
    []
  );

  const updateActiveTab = useCallback(
    (patch: Partial<DocumentTab> | ((prev: DocumentTab) => Partial<DocumentTab>)) => {
      if (!activeTabId) return;
      updateTab(activeTabId, patch);
    },
    [activeTabId, updateTab]
  );

  const activeTab = useMemo(() => {
    return tabs.find((t) => t.id === activeTabId) || null;
  }, [tabs, activeTabId]);

  const reorderTabs = useCallback((startIndex: number, endIndex: number) => {
    setTabs((prev) => {
      if (startIndex < 0 || startIndex >= prev.length || endIndex < 0 || endIndex >= prev.length) {
        return prev;
      }
      const result = [...prev];
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, []);

  const value = useMemo(
    () => ({
      tabs,
      activeTabId,
      activeTab,
      openTab,
      closeTab,
      reorderTabs,
      setActiveTabId,
      updateTab,
      updateActiveTab,
      quickPickerOpen,
      setQuickPickerOpen,
    }),
    [
      tabs,
      activeTabId,
      activeTab,
      openTab,
      closeTab,
      reorderTabs,
      setActiveTabId,
      updateTab,
      updateActiveTab,
      quickPickerOpen,
      setQuickPickerOpen,
    ]
  );

  return <ReaderTabContext.Provider value={value}>{children}</ReaderTabContext.Provider>;
}

export function useReaderTabs() {
  const ctx = useContext(ReaderTabContext);
  if (!ctx) {
    throw new Error("useReaderTabs must be used within a ReaderTabProvider");
  }
  return ctx;
}
