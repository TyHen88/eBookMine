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
import { BookOpenIcon, PlusIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui";

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

  // Debounced reading progress sync to backend
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (!activeTab || activeTab.currentPage === newPage) return;

      updateActiveTab({ currentPage: newPage });

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
      }, 1000);
    },
    [activeTab, isAuthenticated, numPages, updateActiveTab]
  );

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

  // Text selection handler
  const handleTextSelected = useCallback(
    (text: string, pos: { top: number; left: number }, page: number) => {
      setSelectedText(text);
      setSelectionPos(pos);
      setSelectionPage(page);
    },
    []
  );

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
        onPageChange={handlePageChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleFitWidth={handleToggleFitWidth}
        onThemeChange={handleThemeChange}
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
        onToggleAiDrawer={() => setAiDrawerOpen((p) => !p)}
        onToggleSearch={() => setSearchOpen((p) => !p)}
        onToggleFullscreen={handleFullscreen}
        onToggleBookmark={() => handleToggleBookmark(activeTab.currentPage || 1)}
        onAddNote={() => handleOpenAddNote(undefined, activeTab.currentPage || 1)}
        onOpenBook={() => setQuickPickerOpen(true)}
        onOpenTabsSheet={() => setMobileTabsSheetOpen(true)}
      />

      {/* 3. Main Split Workspace */}
      <div className="relative flex flex-1 h-[calc(100vh-48px)] md:h-[calc(100vh-88px)] w-full overflow-hidden">
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
                onPageChange={handlePageChange}
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
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onJumpPageClick={handleJumpPageClick}
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
        onToggleAiDrawer={() => setAiDrawerOpen((p) => !p)}
        onOpenTabsSheet={() => setMobileTabsSheetOpen(true)}
        onToggleSearch={() => setSearchOpen((p) => !p)}
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
