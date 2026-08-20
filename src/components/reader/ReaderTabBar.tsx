"use client";

import React, { useRef, useEffect, useState } from "react";
import { useReaderTabs, DocumentTab } from "./context/ReaderTabContext";
import { BookOpenIcon, PlusIcon, XIcon } from "@/components/ui/icons";
import BookThumbnailImg from "@/components/BookThumbnailImg";

interface TabHoverPreviewProps {
  tab: DocumentTab;
  index: number;
  position: { left: number; top: number };
}

function TabHoverPreview({ tab, index, position }: TabHoverPreviewProps) {
  const percent =
    tab.pageCount > 0
      ? Math.min(100, Math.round(((tab.currentPage || 1) / tab.pageCount) * 100))
      : 0;

  return (
    <div
      style={{
        left: `${position.left}px`,
        top: `${position.top + 40}px`,
      }}
      className="fixed z-50 pointer-events-none flex w-64 items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur-xl animate-tab-preview"
    >
      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-800 shadow-inner">
        <BookThumbnailImg
          bookId={tab.id}
          cover={tab.cover}
          title={tab.title}
          className="h-full w-full"
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <h4 className="line-clamp-1 text-xs font-bold text-white">
            {tab.title}
          </h4>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono font-bold text-brand-300">
            ⌘{index + 1}
          </span>
        </div>

        <p className="line-clamp-1 text-[10px] text-slate-400">
          {tab.author || "Unknown Author"}
        </p>

        <div className="pt-1">
          <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
            <span>Page {tab.currentPage || 1} / {tab.pageCount || "…"}</span>
            <span className="font-bold text-brand-400">{percent}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReaderTabBar({
  theme = "light",
}: {
  theme?: "light" | "dark" | "sepia";
}) {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    reorderTabs,
    setQuickPickerOpen,
  } = useReaderTabs();

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [hoveredTab, setHoveredTab] = useState<{
    tab: DocumentTab;
    index: number;
    pos: { left: number; top: number };
  } | null>(null);

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!activeTabId || !tabsContainerRef.current) return;
    const activeEl = tabsContainerRef.current.querySelector(
      `[data-tab-id="${activeTabId}"]`
    ) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeTabId]);

  const handleMouseEnterTab = (tab: DocumentTab, index: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredTab({
        tab,
        index,
        pos: { left: Math.max(10, rect.left), top: rect.top },
      });
    }, 250);
  };

  const handleMouseLeaveTab = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredTab(null);
  };

  // Drag and drop reordering
  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
    setHoveredTab(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (dropIdx: number) => {
    if (draggedIdx !== null && draggedIdx !== dropIdx) {
      reorderTabs(draggedIdx, dropIdx);
    }
    setDraggedIdx(null);
  };

  if (tabs.length === 0) return null;

  const bgStyle =
    theme === "sepia"
      ? "bg-[#e2d6be] border-[#d4c6a8]"
      : theme === "dark"
      ? "bg-slate-950 border-slate-800/90"
      : "bg-slate-200/70 border-slate-300/80";

  return (
    <div
      className={`relative hidden md:flex h-10 w-full items-center border-b px-2 gap-1 select-none overflow-visible transition-colors ${bgStyle}`}
    >
      {/* Scrollable Tabs Track with New Tab Button inline */}
      <div
        ref={tabsContainerRef}
        className="flex flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1"
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const isDragging = draggedIdx === idx;

          const tabClass = isActive
            ? theme === "sepia"
              ? "bg-[#f4ecd8] text-[#433422] shadow-sm border border-[#d8cdb4] font-bold scale-[1.01]"
              : theme === "dark"
              ? "bg-slate-900 text-white shadow-md border border-slate-700 font-bold scale-[1.01]"
              : "bg-white text-slate-900 shadow-md border border-slate-200/90 font-bold scale-[1.01]"
            : theme === "sepia"
            ? "text-[#705e46] hover:bg-[#ded3bc]/80 hover:text-[#433422]"
            : theme === "dark"
            ? "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
            : "text-slate-600 hover:bg-white/60 hover:text-slate-900";

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
              onClick={() => setActiveTabId(tab.id)}
              onMouseEnter={(e) => handleMouseEnterTab(tab, idx, e)}
              onMouseLeave={handleMouseLeaveTab}
              className={`group relative flex h-8 max-w-[230px] min-w-[130px] cursor-pointer items-center justify-between rounded-xl px-3 text-xs transition-all duration-200 shrink-0 ${tabClass} ${
                isDragging ? "opacity-40 scale-95" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2 flex-1 pr-1.5">
                <span
                  className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                  }`}
                >
                  <BookOpenIcon size={14} />
                </span>
                <span className="truncate text-[11px] leading-tight font-medium">
                  {tab.title}
                </span>
              </div>

              {/* Close Tab Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md transition-all duration-150 ${
                  isActive
                    ? "text-slate-400 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    : "opacity-0 group-hover:opacity-100 text-slate-400 hover:bg-slate-300/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                }`}
                aria-label={`Close ${tab.title}`}
                title="Close Tab (Ctrl+W / Cmd+W)"
              >
                <XIcon size={11} strokeWidth={2.5} />
              </button>

              {/* Active Tab Ambient Indicator */}
              {isActive && (
                <div className="absolute -bottom-1 left-2.5 right-2.5 h-[2.5px] rounded-full bg-gradient-to-r from-brand-600 to-indigo-500 dark:from-brand-400 dark:to-indigo-400 shadow-sm shadow-brand-500/40" />
              )}
            </div>
          );
        })}

        {/* Add New Tab Button placed directly adjacent to the last tab */}
        <button
          type="button"
          onClick={() => setQuickPickerOpen(true)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
            theme === "sepia"
              ? "text-[#705e46] hover:bg-[#ded3bc] hover:text-[#433422]"
              : theme === "dark"
              ? "text-slate-400 hover:bg-slate-800/90 hover:text-white"
              : "text-slate-500 hover:bg-slate-200 hover:text-slate-900 shadow-sm bg-white/40"
          }`}
          title="New Tab (Open another book • Ctrl+T / Cmd+T)"
          aria-label="Add new tab"
        >
          <PlusIcon size={15} strokeWidth={2.4} />
        </button>
      </div>

      {/* Floating Rich Tab Preview Card on Hover */}
      {hoveredTab && (
        <TabHoverPreview
          tab={hoveredTab.tab}
          index={hoveredTab.index}
          position={hoveredTab.pos}
        />
      )}
    </div>
  );
}
