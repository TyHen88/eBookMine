"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useReaderTabs, DocumentTab } from "./context/ReaderTabContext";
import ReaderTabBar from "./ReaderTabBar";
import ReaderToolbar from "./ReaderToolbar";
import ContinuousViewer from "./ContinuousViewer";
import SelectionHUD from "./SelectionHUD";
import AiAssistantDrawer from "./AiAssistantDrawer";
import ReaderSidebar from "./ReaderSidebar";
import QuickBookPickerModal from "./QuickBookPickerModal";
import MobileTabSwitcherSheet from "./MobileTabSwitcherSheet";
import MobileReadingDock from "./MobileReadingDock";
import NoteEditorModal from "./NoteEditorModal";
import AiActionModal from "./AiActionModal";
import GoogleTranslateModal from "@/components/GoogleTranslateModal";
import { NoteData } from "@/lib/readingService";
import { useToast } from "@/components/ui/Toast";
import { BookOpenIcon, PlusIcon, MarqueeIcon, SparklesIcon, XIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui";
import { SelectedAreaBox } from "./VirtualPage";

export default function ReaderWorkspace() {
  const {
    tabs,
    activeTab,
    activeTabId,
    updateActiveTab,
    updateTab,
    closeTab,
    setActiveTabId,
    setQuickPickerOpen,
  } = useReaderTabs();
  const { status } = useSession();
  const { showToast } = useToast();
  const isAuthenticated = status === "authenticated";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);

  // Area Selection Tool State
  const [isAreaSelectMode, setIsAreaSelectMode] = useState(false);
  const [areaBox, setAreaBox] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isDragging: boolean;
  } | null>(null);
  const [selectedAreaBox, setSelectedAreaBox] = useState<SelectedAreaBox | null>(null);

  // Text selection & HUD state
  const [selectedText, setSelectedText] = useState("");
  const [selectionPos, setSelectionPos] = useState({ top: 0, left: 0 });
  const [selectionPage, setSelectionPage] = useState(1);

  // Note Modal state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalPage, setNoteModalPage] = useState(1);
  const [noteModalSelectedText, setNoteModalSelectedText] = useState<string | undefined>();
  const [noteModalInitialContent, setNoteModalInitialContent] = useState("");
  const [noteModalEditingId, setNoteModalEditingId] = useState<string | undefined>();

  // Translate modal state
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translateText, setTranslateText] = useState("");

  // AI Action Modal state (popup for Explain and Simplify)
  const [aiActionModal, setAiActionModal] = useState<{
    isOpen: boolean;
    actionType: "explain" | "simplify";
    text: string;
    page: number;
    position?: { top: number; left: number };
  }>({
    isOpen: false,
    actionType: "explain",
    text: "",
    page: 1,
  });

  // Mobile tabs sheet state
  const [mobileTabsSheetOpen, setMobileTabsSheetOpen] = useState(false);

  // AI Prompt dispatched from selection HUD
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);

  const saveProgressTimer = useRef<NodeJS.Timeout | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const urlSyncTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced reading progress sync to backend & URL history sync
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (!activeTab || activeTab.currentPage === newPage) return;

      updateActiveTab({ currentPage: newPage });

      // Debounce saving progress to server to handle fast scrolling without DB spam
      if (saveProgressTimer.current) clearTimeout(saveProgressTimer.current);
      saveProgressTimer.current = setTimeout(() => {
        if (isAuthenticated && activeTab.id) {
          fetch("/api/reading/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: activeTab.id,
              currentPage: newPage,
              totalPages: numPages || activeTab.pageCount || 1,
            }),
          }).catch(() => {});
        }
      }, 1200);
    },
    [activeTab, isAuthenticated, numPages, updateActiveTab]
  );

  // Synchronize book metadata and server-saved reading progress/highlights/notes
  useEffect(() => {
    if (!activeTab?.id) return;
    const bookId = activeTab.id;

    // 1. Fetch metadata if incomplete (e.g. direct URL visit or refreshed tab)
    if (activeTab.title === "Loading Document..." || !activeTab.pageCount) {
      fetch(`/api/books/${encodeURIComponent(bookId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.book) {
            updateTab(bookId, (prev) => ({
              title: data.book.title || prev.title,
              author: data.book.author || prev.author,
              cover: data.book.cover ?? prev.cover,
              pageCount: data.book.pageCount || prev.pageCount,
              currentPage: prev.currentPage > 1 ? prev.currentPage : data.book.lastPage || 1,
            }));
          }
        })
        .catch(() => {});
    }

    // 2. Fetch server-saved bookmarks, highlights, and notes for authenticated users
    if (isAuthenticated) {
      Promise.all([
        fetch(`/api/reading/bookmarks?bookId=${encodeURIComponent(bookId)}`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/reading/highlights?bookId=${encodeURIComponent(bookId)}`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/reading/notes?bookId=${encodeURIComponent(bookId)}`).then((r) => (r.ok ? r.json() : [])),
      ])
        .then(([bData, hData, nData]) => {
          updateTab(bookId, {
            bookmarks: Array.isArray(bData) ? bData : [],
            highlights: Array.isArray(hData) ? hData : [],
            notes: Array.isArray(nData) ? nData : [],
          });
        })
        .catch(() => {});
    }
  }, [activeTab?.id, activeTab?.title, activeTab?.pageCount, isAuthenticated, updateTab]);

  // Synchronize browser URL route /read/[id]?page=...&title=... with active tab (Debounced & Safe against browser rate-limits)
  const lastSyncedTabIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeTab?.id || typeof window === "undefined") return;
    const titleParam =
      activeTab.title && activeTab.title !== "Loading Document..."
        ? `&title=${encodeURIComponent(activeTab.title)}`
        : "";
    const targetUrl = `/read/${encodeURIComponent(activeTab.id)}?page=${activeTab.currentPage || 1}${titleParam}`;
    const currentPath = window.location.pathname + window.location.search;

    if (lastSyncedTabIdRef.current === null) {
      lastSyncedTabIdRef.current = activeTab.id;
      if (currentPath !== targetUrl) {
        try {
          window.history.replaceState(null, "", targetUrl);
        } catch {}
      }
    } else if (lastSyncedTabIdRef.current !== activeTab.id) {
      // Switched tab or opened new book -> push to browser history so refresh & navigation works
      lastSyncedTabIdRef.current = activeTab.id;
      if (currentPath !== targetUrl) {
        try {
          window.history.pushState(null, "", targetUrl);
        } catch {}
      }
    } else {
      // Page changed during reading -> debounce replaceState to avoid SecurityError during fast scrolling
      if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
      urlSyncTimer.current = setTimeout(() => {
        try {
          const freshPath = window.location.pathname + window.location.search;
          if (freshPath !== targetUrl) {
            window.history.replaceState(null, "", targetUrl);
          }
        } catch {}
      }, 350);
    }

    return () => {
      if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    };
  }, [activeTab?.id, activeTab?.title, activeTab?.currentPage]);

  const handlePrevPage = () => {
    if (!activeTab) return;
    const cur = activeTab.currentPage || 1;
    if (cur > 1) handlePageChange(cur - 1);
  };

  const handleNextPage = () => {
    if (!activeTab) return;
    const cur = activeTab.currentPage || 1;
    const total = numPages || activeTab.pageCount || 1;
    if (cur < total) handlePageChange(cur + 1);
  };

  const handleJumpPageClick = () => {
    if (!activeTab) return;
    const total = numPages || activeTab.pageCount || 1;
    const input = prompt(`Jump to page (1 - ${total}):`, String(activeTab.currentPage || 1));
    if (input) {
      const pageNum = parseInt(input, 10);
      if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= total) {
        handlePageChange(pageNum);
      }
    }
  };

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    if (!activeTab) return;
    const nextScale = Math.min(2.5, (activeTab.scale || 1.0) + 0.15);
    updateActiveTab({ scale: nextScale, fitWidth: false });
  }, [activeTab, updateActiveTab]);

  const handleZoomOut = useCallback(() => {
    if (!activeTab) return;
    const nextScale = Math.max(0.6, (activeTab.scale || 1.0) - 0.15);
    updateActiveTab({ scale: nextScale, fitWidth: false });
  }, [activeTab, updateActiveTab]);

  const handleToggleFitWidth = useCallback(() => {
    if (!activeTab) return;
    updateActiveTab((prev) => ({
      fitWidth: !prev.fitWidth,
      scale: 1.0,
    }));
  }, [activeTab, updateActiveTab]);

  const handleThemeChange = useCallback(
    (newTheme: "light" | "dark" | "sepia") => {
      updateActiveTab({ theme: newTheme });
      if (typeof window !== "undefined") {
        if (newTheme === "dark") {
          document.documentElement.classList.add("dark");
          localStorage.setItem("ebookmine-theme", "dark");
        } else if (newTheme === "light") {
          document.documentElement.classList.remove("dark");
          localStorage.setItem("ebookmine-theme", "light");
        }
      }
    },
    [updateActiveTab]
  );

  // Synchronize document dark class with active tab's theme
  useEffect(() => {
    if (!activeTab) return;
    if (activeTab.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (activeTab.theme === "light") {
      document.documentElement.classList.remove("dark");
    }
  }, [activeTab]);

  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const closeTabRef = useRef(closeTab);
  const setActiveTabIdRef = useRef(setActiveTabId);
  const setQuickPickerOpenRef = useRef(setQuickPickerOpen);

  useEffect(() => {
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
    closeTabRef.current = closeTab;
    setActiveTabIdRef.current = setActiveTabId;
    setQuickPickerOpenRef.current = setQuickPickerOpen;
  });

  // Browser-like keyboard shortcuts for Tab Management (Stable single listener)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+T / Ctrl+T: Open New Tab
      if (isMeta && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setQuickPickerOpenRef.current(true);
        return;
      }

      // Cmd+W / Ctrl+W: Close active Tab
      if (isMeta && e.key.toLowerCase() === "w" && activeTabIdRef.current) {
        e.preventDefault();
        closeTabRef.current(activeTabIdRef.current);
        return;
      }

      // Cmd+1 .. Cmd+9 / Ctrl+1 .. Ctrl+9: Switch to Tab Index
      if (isMeta && e.key >= "1" && e.key <= "9") {
        const tabIndex = parseInt(e.key, 10) - 1;
        const currentTabs = tabsRef.current;
        if (currentTabs[tabIndex]) {
          e.preventDefault();
          setActiveTabIdRef.current(currentTabs[tabIndex].id);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Sync cursor class across document when area selection mode is active
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

  const extractTextFromBoxRect = (minX: number, minY: number, maxX: number, maxY: number): string => {
    const textNodes = document.querySelectorAll(
      ".react-pdf__Page__textLayer span, .react-pdf__Page__textContent span, .textLayer span, .react-pdf__Page__textLayer *, .textLayer *"
    );
    const matched: { text: string; top: number; left: number }[] = [];
    const seenTexts = new Set<string>();

    textNodes.forEach((node) => {
      if (node.children.length > 0) return;
      const txt = node.textContent?.trim();
      if (!txt) return;

      const rect = node.getBoundingClientRect();
      if (
        rect.right >= minX - 10 &&
        rect.left <= maxX + 10 &&
        rect.bottom >= minY - 10 &&
        rect.top <= maxY + 10
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

  const handleAreaPointerUp = async (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    } catch {}

    if (!isAreaSelectMode || !areaBox?.isDragging) return;

    let minX = Math.min(areaBox.startX, e.clientX);
    let maxX = Math.max(areaBox.startX, e.clientX);
    let minY = Math.min(areaBox.startY, e.clientY);
    let maxY = Math.max(areaBox.startY, e.clientY);

    let width = maxX - minX;
    let height = maxY - minY;

    setIsAreaSelectMode(false);
    setAreaBox(null);

    // Mobile single tap auto-detection: if user tapped instead of dragging
    if (width < 20 && height < 20) {
      if (typeof document !== "undefined") {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const textSpan = elements.find(
          (el) =>
            el.tagName === "SPAN" &&
            (el.closest(".react-pdf__Page__textContent") || el.closest(".textLayer"))
        ) as HTMLElement | undefined;

        if (textSpan) {
          const spanRect = textSpan.getBoundingClientRect();
          minX = Math.max(0, spanRect.left - 6);
          maxX = spanRect.right + 6;
          minY = Math.max(0, spanRect.top - 4);
          maxY = spanRect.bottom + 4;
          width = maxX - minX;
          height = maxY - minY;
        } else {
          const pageEl = elements.find((el) => el.hasAttribute("data-page-number")) as HTMLElement | undefined;
          if (pageEl) {
            const pageRect = pageEl.getBoundingClientRect();
            const targetWidth = Math.min(pageRect.width - 24, 300);
            const targetHeight = 90;
            minX = Math.max(pageRect.left + 12, Math.min(pageRect.right - targetWidth - 12, e.clientX - targetWidth / 2));
            maxX = minX + targetWidth;
            minY = Math.max(pageRect.top + 12, Math.min(pageRect.bottom - targetHeight - 12, e.clientY - targetHeight / 2));
            maxY = minY + targetHeight;
            width = maxX - minX;
            height = maxY - minY;
          }
        }
      }
    }

    if (width > 12 && height > 12) {
      let textToUse = extractTextFromBoxRect(minX, minY, maxX, maxY);

      // Find the page element under the selection
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const pageElements = Array.from(document.querySelectorAll<HTMLElement>("[data-page-number]"));
      let targetPageEl: HTMLElement | null = null;
      let targetPageNum = activeTab?.currentPage || 1;

      for (const el of pageElements) {
        const rect = el.getBoundingClientRect();
        if (
          centerY >= rect.top &&
          centerY <= rect.bottom &&
          centerX >= rect.left &&
          centerX <= rect.right
        ) {
          targetPageEl = el;
          targetPageNum = parseInt(el.getAttribute("data-page-number") || "1", 10);
          break;
        }
      }

      if (!targetPageEl) {
        for (const el of pageElements) {
          const rect = el.getBoundingClientRect();
          if (maxY >= rect.top && minY <= rect.bottom) {
            targetPageEl = el;
            targetPageNum = parseInt(el.getAttribute("data-page-number") || "1", 10);
            break;
          }
        }
      }

      if (!textToUse && pdfDoc && activeTab) {
        try {
          const pdfPage = await pdfDoc.getPage(targetPageNum);
          const content = await pdfPage.getTextContent();
          const pageStr = content.items.map((i: any) => i.str).join(" ").trim();
          if (pageStr) {
            textToUse = pageStr.substring(0, 400);
          }
        } catch {}
      }

      if (!textToUse || !textToUse.trim()) {
        textToUse = `Selected Region on Page ${targetPageNum}`;
      }

      try {
        window.getSelection()?.removeAllRanges();
      } catch {}

      if (targetPageEl) {
        const pageRect = targetPageEl.getBoundingClientRect();
        const relX = Math.max(0, Math.min(100, ((minX - pageRect.left) / pageRect.width) * 100));
        const relY = Math.max(0, Math.min(100, ((minY - pageRect.top) / pageRect.height) * 100));
        const relW = Math.max(2, Math.min(100, ((maxX - minX) / pageRect.width) * 100));
        const relH = Math.max(2, Math.min(100, ((maxY - minY) / pageRect.height) * 100));

        // Retain persistent highlight of the selected area locked to the exact page
        setSelectedAreaBox({
          page: targetPageNum,
          relX,
          relY,
          relW,
          relH,
          text: textToUse,
          isAiOpened: false,
        });
      }
    } else {
      setSelectedAreaBox(null);
    }
  };

  const handleAskAiArea = useCallback((text: string, page: number) => {
    setSelectedAreaBox((prev) => (prev ? { ...prev, isAiOpened: true } : null));
    setAiInitialPrompt(text.trim());
    setAiDrawerOpen(true);
  }, []);

  const handleDismissArea = useCallback(() => {
    setSelectedAreaBox(null);
  }, []);

  // Text selection handler
  const handleTextSelected = useCallback(
    (text: string, pos: { top: number; left: number }, page: number) => {
      setSelectedText(text);
      setSelectionPos(pos);
      setSelectionPage(page);
    },
    []
  );

  const handleAskAiSelection = useCallback((text: string) => {
    setAiInitialPrompt(text.trim());
    setAiDrawerOpen(true);
  }, []);

  // Selection HUD Actions: Open dedicated AI Action popup above selection
  const handleExplainSelection = (text: string, page: number, pos?: { top: number; left: number }) => {
    setAiActionModal({
      isOpen: true,
      actionType: "explain",
      text,
      page,
      position: pos || selectionPos || undefined,
    });
  };

  const handleSimplifySelection = (text: string, page: number, pos?: { top: number; left: number }) => {
    setAiActionModal({
      isOpen: true,
      actionType: "simplify",
      text,
      page,
      position: pos || selectionPos || undefined,
    });
  };

  const handleTranslateSelection = (text: string) => {
    setTranslateText(text);
    setTranslateOpen(true);
  };

  const handleAddHighlight = async (text: string, color: string, page: number) => {
    if (!activeTab) return;
    const tempId = `hl-${Date.now()}`;
    const newHl = {
      id: tempId,
      page,
      selectedText: text,
      color,
      createdAt: new Date().toISOString(),
    };

    updateActiveTab((prev) => ({
      highlights: [...(prev.highlights || []), newHl],
    }));

    showToast("Highlight saved", "success");

    if (isAuthenticated) {
      fetch("/api/reading/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: activeTab.id,
          page,
          selectedText: text,
          color,
        }),
      }).catch(() => {});
    }
  };

  // Open Add Note Modal
  const handleOpenAddNote = useCallback(
    (text?: string, page?: number) => {
      setNoteModalSelectedText(text || undefined);
      setNoteModalPage(page || activeTab?.currentPage || 1);
      setNoteModalInitialContent("");
      setNoteModalEditingId(undefined);
      setNoteModalOpen(true);
    },
    [activeTab]
  );

  // Open Edit Note Modal
  const handleOpenEditNote = useCallback((note: NoteData) => {
    setNoteModalSelectedText(undefined);
    setNoteModalPage(note.page);
    setNoteModalInitialContent(note.content);
    setNoteModalEditingId(note.id);
    setNoteModalOpen(true);
  }, []);

  // Save Note Modal Handler (both create and update)
  const handleSaveNoteModal = useCallback(
    async (content: string, page: number, noteId?: string) => {
      if (!activeTab || !content.trim()) return;

      if (noteId) {
        // Edit existing note
        updateActiveTab((prev) => ({
          notes: (prev.notes || []).map((n) =>
            n.id === noteId
              ? { ...n, content: content.trim(), updatedAt: new Date().toISOString() }
              : n
          ),
        }));
        showToast("Note updated", "success");

        if (isAuthenticated) {
          fetch("/api/reading/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: activeTab.id,
              page,
              content: content.trim(),
              id: noteId,
            }),
          }).catch(() => {});
        }
      } else {
        // Create new note
        const tempId = `note-${Date.now()}`;
        const newNote: NoteData = {
          id: tempId,
          page,
          content: content.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        updateActiveTab((prev) => ({
          notes: [...(prev.notes || []), newNote],
        }));
        showToast("Note saved", "success");

        if (isAuthenticated) {
          fetch("/api/reading/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: activeTab.id,
              page,
              content: content.trim(),
            }),
          }).catch(() => {});
        }
      }
    },
    [activeTab, isAuthenticated, showToast, updateActiveTab]
  );

  const handlePlayTTS = useCallback(
    (text: string) => {
      if (!text || !text.trim()) return;

      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }

      const audio = new Audio(
        `/api/tts?text=${encodeURIComponent(text.slice(0, 800))}&lang=auto`
      );
      currentAudioRef.current = audio;

      audio.onended = () => {
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      };

      audio.play().catch(() => showToast("Could not play audio", "error"));
    },
    [showToast]
  );

  // Toggle Bookmark for current or specified page
  const handleToggleBookmark = useCallback(
    async (pageToBookmark?: number) => {
      if (!activeTab) return;
      const targetPage = pageToBookmark || activeTab.currentPage || 1;
      const existingBookmark = (activeTab.bookmarks || []).find((b) => b.page === targetPage);

      if (existingBookmark) {
        updateActiveTab((prev) => ({
          bookmarks: (prev.bookmarks || []).filter((b) => b.id !== existingBookmark.id),
        }));
        showToast(`Bookmark removed for Page ${targetPage}`, "info");

        if (isAuthenticated) {
          fetch(`/api/reading/bookmarks?id=${encodeURIComponent(existingBookmark.id)}`, {
            method: "DELETE",
          }).catch(() => {});
        }
      } else {
        const tempId = `bm-${Date.now()}`;
        const newBm = {
          id: tempId,
          page: targetPage,
          title: `Page ${targetPage}`,
          createdAt: new Date().toISOString(),
        };

        updateActiveTab((prev) => ({
          bookmarks: [...(prev.bookmarks || []), newBm],
        }));
        showToast(`Page ${targetPage} bookmarked`, "success");

        if (isAuthenticated) {
          fetch("/api/reading/bookmarks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: activeTab.id,
              page: targetPage,
              title: `Page ${targetPage}`,
            }),
          }).catch(() => {});
        }
      }
    },
    [activeTab, isAuthenticated, showToast, updateActiveTab]
  );

  // Sidebar Deletions
  const handleDeleteBookmark = useCallback(
    (id: string) => {
      if (!activeTab) return;
      updateActiveTab((prev) => ({
        bookmarks: (prev.bookmarks || []).filter((b) => b.id !== id),
      }));
      if (isAuthenticated) {
        fetch(`/api/reading/bookmarks?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    },
    [activeTab, isAuthenticated, updateActiveTab]
  );

  const handleDeleteHighlight = useCallback(
    (id: string) => {
      if (!activeTab) return;
      updateActiveTab((prev) => ({
        highlights: (prev.highlights || []).filter((h) => h.id !== id),
      }));
      if (isAuthenticated) {
        fetch(`/api/reading/highlights?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    },
    [activeTab, isAuthenticated, updateActiveTab]
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      if (!activeTab) return;
      updateActiveTab((prev) => ({
        notes: (prev.notes || []).filter((n) => n.id !== id),
      }));
      if (isAuthenticated) {
        fetch(`/api/reading/notes?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    },
    [activeTab, isAuthenticated, updateActiveTab]
  );

  // If no tabs are open, show empty state with book picker
  if (!activeTab || tabs.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-900 p-6 text-center space-y-4 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30">
          <BookOpenIcon size={32} />
        </div>
        <div className="space-y-1 max-w-sm">
          <h2 className="text-lg font-bold">No Documents Open</h2>
          <p className="text-xs text-slate-400">
            Open a book from your personal library to start reading in your multi-tab workspace.
          </p>
        </div>
        <Button onClick={() => setQuickPickerOpen(true)} size="md">
          <PlusIcon size={16} />
          <span>Open Book</span>
        </Button>
        <QuickBookPickerModal />
      </div>
    );
  }

  const isCurrentPageBookmarked = Boolean(
    activeTab.bookmarks?.some((b) => b.page === (activeTab.currentPage || 1))
  );

  const fileUrl = isAuthenticated
    ? `/api/books/${activeTab.id}/file`
    : `/api/public/books/${activeTab.id}/file`;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950">
      {/* 1. Multi-Document Tab Bar */}
      <ReaderTabBar theme={activeTab.theme} />

      {/* 2. Top Acrobat Controls Toolbar */}
      <ReaderToolbar
        tab={activeTab}
        tabsCount={tabs.length}
        numPages={numPages}
        currentPage={activeTab.currentPage || 1}
        scale={activeTab.scale || 1.0}
        fitWidth={Boolean(activeTab.fitWidth)}
        theme={activeTab.theme || "light"}
        sidebarOpen={sidebarOpen}
        aiDrawerOpen={aiDrawerOpen}
        searchOpen={searchOpen}
        isBookmarked={isCurrentPageBookmarked}
        isAreaSelectMode={isAreaSelectMode}
        onPageChange={handlePageChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleFitWidth={handleToggleFitWidth}
        onThemeChange={handleThemeChange}
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
        onToggleAiDrawer={() => setAiDrawerOpen((p) => !p)}
        onToggleSearch={() => setSearchOpen((p) => !p)}
        onToggleAreaSelect={() => {
          setIsAreaSelectMode((p) => !p);
          if (areaBox) setAreaBox(null);
        }}
        onToggleFullscreen={handleFullscreen}
        onToggleBookmark={() => handleToggleBookmark(activeTab.currentPage || 1)}
        onAddNote={() => handleOpenAddNote(undefined, activeTab.currentPage || 1)}
        onOpenBook={() => setQuickPickerOpen(true)}
        onOpenTabsSheet={() => setMobileTabsSheetOpen(true)}
      />

      {/* 3. Main Split Workspace */}
      <div
        className="relative flex flex-1 h-[calc(100vh-48px)] md:h-[calc(100vh-88px)] w-full overflow-hidden"
      >
        {/* Full-Screen Touch & Pointer Capture Overlay for Mobile & Desktop Area Selection */}
        {isAreaSelectMode && (
          <div
            onPointerDown={handleAreaPointerDown}
            onPointerMove={handleAreaPointerMove}
            onPointerUp={handleAreaPointerUp}
            onPointerCancel={() => {
              setIsAreaSelectMode(false);
              setAreaBox(null);
            }}
            style={{ touchAction: "none" }}
            className="fixed inset-0 z-50 cursor-crosshair select-none touch-none bg-brand-500/[0.04] backdrop-blur-[0.5px]"
          >
            {/* Active Area Select Mode Floating Banner Indicator */}
            <div className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 whitespace-nowrap rounded-full border border-brand-400 bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-2xl animate-scaleUp">
              <MarqueeIcon size={16} />
              <span>
                <span className="hidden sm:inline">Area Select Active — Drag box over text/diagram</span>
                <span className="sm:hidden">Touch & drag or tap area to select</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAreaSelectMode(false);
                  setAreaBox(null);
                }}
                className="ml-2 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold hover:bg-white/30 transition active:scale-95"
                title="Cancel Area Select"
              >
                Cancel
              </button>
            </div>

            {/* Figma-Style Area Selection Box Overlay (Live Dragging only) */}
            {areaBox?.isDragging && (() => {
              const left = Math.min(areaBox.startX, areaBox.endX);
              const top = Math.min(areaBox.startY, areaBox.endY);
              const width = Math.abs(areaBox.endX - areaBox.startX);
              const height = Math.abs(areaBox.endY - areaBox.startY);
              if (width < 3 && height < 3) return null;

              return (
                <div
                  style={{
                    position: "fixed",
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                  }}
                  className="z-50 border-2 border-brand-500 bg-brand-500/20 shadow-2xl ring-2 ring-brand-400/50 rounded-lg pointer-events-none"
                >
                  {/* Figma Corner Handles with touch visibility */}
                  <div className="absolute -left-1.5 -top-1.5 h-3.5 w-3.5 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />
                  <div className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />
                  <div className="absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />
                  <div className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-sm bg-brand-600 ring-2 ring-white shadow-sm" />

                  {/* Dimensions Badge */}
                  <div className="absolute -top-7 left-0 inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                    <span>Selecting ({Math.round(width)}×{Math.round(height)})</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Left Navigation Sidebar */}
        <ReaderSidebar
          tab={activeTab}
          pdfDoc={pdfDoc}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onJumpToPage={(p) => handlePageChange(p)}
          onDeleteBookmark={handleDeleteBookmark}
          onDeleteHighlight={handleDeleteHighlight}
          onDeleteNote={handleDeleteNote}
          onEditNote={handleOpenEditNote}
          onAddNote={(p) => handleOpenAddNote(undefined, p)}
        />

        {/* Center High-Performance Continuous Viewer per Tab (Instant 0ms Switch) */}
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const tabFileUrl = isAuthenticated
            ? `/api/books/${tab.id}/file`
            : `/api/public/books/${tab.id}/file`;

          return (
            <div
              key={tab.id}
              className={`flex-1 h-full w-full overflow-hidden ${
                isActive ? "flex" : "hidden"
              }`}
            >
              <ContinuousViewer
                tab={tab}
                fileUrl={tabFileUrl}
                theme={tab.theme || "light"}
                currentPage={tab.currentPage || 1}
                scale={tab.scale || 1.0}
                fitWidth={Boolean(tab.fitWidth)}
                isActive={isActive}
                selectedArea={isActive ? selectedAreaBox : null}
                onAskAiArea={handleAskAiArea}
                onDismissArea={handleDismissArea}
                onPageChange={(p) => {
                  if (isActive) {
                    handlePageChange(p);
                  } else {
                    updateTab(tab.id, { currentPage: p });
                  }
                }}
                onNumPagesChange={(n) => {
                  if (isActive) setNumPages(n);
                  updateTab(tab.id, { pageCount: n });
                }}
                onPdfDocLoaded={(doc) => {
                  if (isActive) setPdfDoc(doc);
                }}
                onTextSelected={handleTextSelected}
              />
            </div>
          );
        })}

        {/* Right Adobe AI Study Companion Drawer */}
        <AiAssistantDrawer
          tab={activeTab}
          currentPage={activeTab.currentPage || 1}
          isOpen={aiDrawerOpen}
          initialPrompt={aiInitialPrompt}
          onClearInitialPrompt={() => setAiInitialPrompt(undefined)}
          onClose={() => {
            setAiDrawerOpen(false);
            setAiInitialPrompt(undefined);
          }}
          onJumpToPage={(p) => handlePageChange(p)}
          onUpdateChatHistory={(messages) => updateActiveTab({ chatHistory: messages })}
        />
      </div>

      {/* 4. Mobile Floating Reading Dock */}
      <MobileReadingDock
        tab={activeTab}
        currentPage={activeTab.currentPage || 1}
        numPages={numPages || activeTab.pageCount || 0}
        theme={activeTab.theme || "light"}
        tabsCount={tabs.length}
        sidebarOpen={sidebarOpen}
        aiDrawerOpen={aiDrawerOpen}
        isBookmarked={isCurrentPageBookmarked}
        isAreaSelectMode={isAreaSelectMode}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onJumpPageClick={handleJumpPageClick}
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
        onToggleAiDrawer={() => setAiDrawerOpen((p) => !p)}
        onOpenTabsSheet={() => setMobileTabsSheetOpen(true)}
        onToggleSearch={() => setSearchOpen((p) => !p)}
        onToggleAreaSelect={() => {
          setIsAreaSelectMode((p) => !p);
          if (areaBox) setAreaBox(null);
        }}
        onToggleBookmark={() => handleToggleBookmark(activeTab.currentPage || 1)}
        onAddNote={() => handleOpenAddNote(undefined, activeTab.currentPage || 1)}
      />

      {/* 5. Mobile Tab Switcher Bottom Sheet */}
      <MobileTabSwitcherSheet
        isOpen={mobileTabsSheetOpen}
        theme={activeTab.theme || "light"}
        onClose={() => setMobileTabsSheetOpen(false)}
      />

      {/* 6. Floating Contextual Selection HUD */}
      {selectedText && (
        <SelectionHUD
          selectedText={selectedText}
          position={selectionPos}
          page={selectionPage}
          onClose={() => setSelectedText("")}
          onAskAi={handleAskAiSelection}
          onExplain={handleExplainSelection}
          onSimplify={handleSimplifySelection}
          onTranslate={handleTranslateSelection}
          onAddHighlight={handleAddHighlight}
          onAddNote={handleOpenAddNote}
          onPlayTTS={handlePlayTTS}
        />
      )}

      {/* 7. Google Translate Floating Modal */}
      {translateOpen && (
        <GoogleTranslateModal
          initialText={translateText}
          theme={activeTab.theme || "light"}
          onClose={() => setTranslateOpen(false)}
        />
      )}

      {/* 8. AI Action Modal Popup (Stream typing for Explain and Simplify) */}
      <AiActionModal
        isOpen={aiActionModal.isOpen}
        actionType={aiActionModal.actionType}
        selectedText={aiActionModal.text}
        page={aiActionModal.page}
        position={aiActionModal.position}
        bookTitle={activeTab.title}
        author={activeTab.author}
        theme={activeTab.theme || "light"}
        onClose={() => setAiActionModal((p) => ({ ...p, isOpen: false }))}
        onSaveAsNote={(content, p) => handleSaveNoteModal(content, p)}
        onAskAiInDrawer={(prompt) => {
          setAiInitialPrompt(prompt);
          setAiDrawerOpen(true);
        }}
        onPlayTTS={handlePlayTTS}
      />

      {/* 8. Note Editor Modal / Mobile Sheet */}
      <NoteEditorModal
        isOpen={noteModalOpen}
        page={noteModalPage}
        selectedText={noteModalSelectedText}
        initialContent={noteModalInitialContent}
        editingNoteId={noteModalEditingId}
        theme={activeTab.theme || "light"}
        onClose={() => setNoteModalOpen(false)}
        onSave={handleSaveNoteModal}
        onDelete={handleDeleteNote}
      />

      {/* 9. Quick Book Switcher Modal */}
      <QuickBookPickerModal theme={activeTab.theme || "light"} />
    </div>
  );
}
