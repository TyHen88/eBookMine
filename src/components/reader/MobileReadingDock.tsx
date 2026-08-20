"use client";

import React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  PanelLeftIcon,
  BookOpenIcon,
  SearchIcon,
  BookmarkIcon,
  FileTextIcon,
} from "@/components/ui/icons";
import { DocumentTab } from "./context/ReaderTabContext";

interface MobileReadingDockProps {
  tab: DocumentTab;
  currentPage: number;
  numPages: number;
  theme: "light" | "dark" | "sepia";
  tabsCount: number;
  sidebarOpen: boolean;
  aiDrawerOpen: boolean;
  isBookmarked?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpPageClick: () => void;
  onToggleSidebar: () => void;
  onToggleAiDrawer: () => void;
  onOpenTabsSheet: () => void;
  onToggleSearch: () => void;
  onToggleBookmark?: () => void;
  onAddNote?: () => void;
}

export default function MobileReadingDock({
  tab,
  currentPage,
  numPages,
  theme,
  tabsCount,
  sidebarOpen,
  aiDrawerOpen,
  isBookmarked,
  onPrevPage,
  onNextPage,
  onJumpPageClick,
  onToggleSidebar,
  onToggleAiDrawer,
  onOpenTabsSheet,
  onToggleSearch,
  onToggleBookmark,
  onAddNote,
}: MobileReadingDockProps) {
  const bgStyle =
    theme === "sepia"
      ? "bg-[#f4ecd8]/95 border-[#d8cdb4] text-[#433422]"
      : theme === "dark"
      ? "bg-slate-900/95 border-slate-700/80 text-white"
      : "bg-white/95 border-slate-200/90 text-slate-900";

  return (
    <div className="fixed bottom-3 inset-x-3 z-40 flex items-center justify-center pointer-events-none md:hidden animate-slideUp select-none">
      <div className={`pointer-events-auto flex w-full max-w-sm items-center justify-between rounded-2xl border p-1 sm:p-1.5 shadow-2xl backdrop-blur-xl transition-all duration-200 ${bgStyle}`}>
        {/* Page Step Buttons */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-black/5 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/10 active:scale-95 transition"
            aria-label="Previous Page"
          >
            <ChevronLeftIcon size={16} />
          </button>

          {/* Current Page Pill (Tap to Jump) */}
          <button
            type="button"
            onClick={onJumpPageClick}
            className="flex items-center gap-1 rounded-xl bg-black/5 px-2 py-1 text-xs font-bold dark:bg-white/10 active:scale-95 transition"
            title="Jump to page"
          >
            <span>{currentPage}</span>
            <span className="text-[10px] text-slate-400">/ {numPages || "…"}</span>
          </button>

          <button
            type="button"
            onClick={onNextPage}
            disabled={currentPage >= (numPages || 1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-black/5 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/10 active:scale-95 transition"
            aria-label="Next Page"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />

        {/* Quick Tools */}
        <div className="flex items-center gap-1 shrink-0">
          {/* TOC / Sidebar Toggle */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition active:scale-95 ${
              sidebarOpen
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
            title="Table of Contents & Notes"
          >
            <PanelLeftIcon size={15} />
          </button>

          {/* Bookmark Current Page */}
          <button
            type="button"
            onClick={onToggleBookmark}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition active:scale-95 ${
              isBookmarked
                ? "bg-amber-500 text-white shadow-sm scale-105"
                : "text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
            title={isBookmarked ? `Remove bookmark from Page ${currentPage}` : `Bookmark Page ${currentPage}`}
          >
            <BookmarkIcon size={15} filled={isBookmarked} />
          </button>

          {/* Add Margin Note */}
          {onAddNote && (
            <button
              type="button"
              onClick={onAddNote}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10 active:scale-95 transition"
              title={`Add Note for Page ${currentPage}`}
            >
              <FileTextIcon size={15} />
            </button>
          )}

          {/* AI Assistant Toggle */}
          <button
            type="button"
            onClick={onToggleAiDrawer}
            className={`flex h-8 items-center gap-1 rounded-xl px-2 text-xs font-bold transition active:scale-95 ${
              aiDrawerOpen
                ? "bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/30"
                : "bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 dark:bg-brand-400/10 dark:text-brand-300"
            }`}
            title="AI Study Tutor"
          >
            <SparklesIcon size={13} />
            <span className="text-[11px]">AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}
