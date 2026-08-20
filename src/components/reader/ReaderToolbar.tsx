"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  MinusIcon,
  PlusIcon,
  SparklesIcon,
  SearchIcon,
  PanelLeftIcon,
  MaximizeIcon,
  SunIcon,
  MoonIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BookmarkIcon,
  FileTextIcon,
} from "@/components/ui/icons";
import { DocumentTab } from "./context/ReaderTabContext";

interface ReaderToolbarProps {
  tab: DocumentTab;
  tabsCount: number;
  numPages: number;
  currentPage: number;
  scale: number;
  fitWidth: boolean;
  theme: "light" | "dark" | "sepia";
  sidebarOpen: boolean;
  aiDrawerOpen: boolean;
  searchOpen: boolean;
  isBookmarked?: boolean;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFitWidth: () => void;
  onThemeChange: (theme: "light" | "dark" | "sepia") => void;
  onToggleSidebar: () => void;
  onToggleAiDrawer: () => void;
  onToggleSearch: () => void;
  onToggleFullscreen: () => void;
  onToggleBookmark?: () => void;
  onAddNote?: () => void;
  onOpenBook?: () => void;
  onOpenTabsSheet: () => void;
}

export default function ReaderToolbar({
  tab,
  tabsCount,
  numPages,
  currentPage,
  scale,
  fitWidth,
  theme,
  sidebarOpen,
  aiDrawerOpen,
  searchOpen,
  isBookmarked,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onToggleFitWidth,
  onThemeChange,
  onToggleSidebar,
  onToggleAiDrawer,
  onToggleSearch,
  onToggleFullscreen,
  onToggleBookmark,
  onAddNote,
  onOpenBook,
  onOpenTabsSheet,
}: ReaderToolbarProps) {
  const [editingPage, setEditingPage] = useState<string | null>(null);

  const displayPage = editingPage !== null ? editingPage : String(currentPage);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPage !== null) {
      const p = parseInt(editingPage, 10);
      if (!Number.isNaN(p) && p >= 1 && p <= (numPages || 9999)) {
        onPageChange(p);
      }
    }
    setEditingPage(null);
  };

  const themeClass =
    theme === "sepia"
      ? "bg-[#f4ecd8] border-[#d8cdb4] text-[#433422]"
      : theme === "dark"
      ? "bg-slate-900/95 border-slate-800 text-white"
      : "bg-white/95 border-slate-200/90 text-slate-900";

  // Cycle theme for single mobile button
  const handleCycleTheme = () => {
    if (theme === "light") onThemeChange("sepia");
    else if (theme === "sepia") onThemeChange("dark");
    else onThemeChange("light");
  };

  return (
    <header
      className={`relative z-20 flex h-12 w-full items-center justify-between border-b px-2 sm:px-3 py-1.5 shadow-sm backdrop-blur-md transition-colors ${themeClass}`}
    >
      {/* Left section: Back & Mobile Tab Switcher Chip & New Book (+) & Desktop Sidebar toggle */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <Link
          href="/library"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition"
          title="Back to Library"
        >
          <ArrowLeftIcon size={18} />
        </Link>

        {/* Mobile Tab Switcher Trigger Chip */}
        <button
          type="button"
          onClick={onOpenTabsSheet}
          className="flex md:hidden items-center gap-1 rounded-xl bg-black/5 px-2 py-1 text-xs font-bold dark:bg-white/10 active:scale-95 transition max-w-[110px] sm:max-w-[150px]"
          title="Switch Documents"
        >
          <span className="truncate text-[11px] font-bold">
            {tab.title}
          </span>
          <span className="shrink-0 rounded-full bg-brand-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white">
            {tabsCount}
          </span>
        </button>

        {/* Add / Open Book (+) Button on Nav (Mobile Only) */}
        {onOpenBook && (
          <button
            type="button"
            onClick={onOpenBook}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-xl text-slate-600 hover:bg-brand-500/15 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-brand-400/20 dark:hover:text-brand-300 active:scale-95 transition"
            title="Open another book / Add Document (Ctrl+O / Cmd+O)"
            aria-label="Add or open book"
          >
            <PlusIcon size={16} strokeWidth={2.4} />
          </button>
        )}

        {/* Desktop Sidebar Toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`hidden md:flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition ${
            sidebarOpen
              ? "bg-brand-600 text-white shadow-sm shadow-brand-500/25"
              : "text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
          }`}
          title="Toggle Navigation & Notes Sidebar"
        >
          <PanelLeftIcon size={16} />
          <span>Sidebar</span>
        </button>

        <div className="hidden lg:flex items-center gap-2 border-l border-slate-200/80 pl-2.5 dark:border-slate-800">
          <span className="max-w-[200px] xl:max-w-[300px] truncate text-xs font-bold text-slate-800 dark:text-slate-200" title={tab.title}>
            {tab.title}
          </span>
        </div>
      </div>

      {/* Center Section: Desktop Page Navigation & Zoom Controls */}
      <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
        {/* Page Jump Form */}
        <form onSubmit={handlePageSubmit} className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/10 transition"
            title="Previous Page"
          >
            <ChevronLeftIcon size={14} />
          </button>

          <input
            type="text"
            value={displayPage}
            onChange={(e) => setEditingPage(e.target.value)}
            onBlur={handlePageSubmit}
            aria-label="Current page number"
            className="h-7 w-10 sm:w-12 rounded-lg border border-slate-300/80 bg-white/80 text-center font-bold text-slate-900 shadow-inner outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white transition"
          />

          <span className="text-[11px] font-medium text-slate-400">
            / {numPages || "…"}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(numPages || 1, currentPage + 1))}
            disabled={currentPage >= (numPages || 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/10 transition"
            title="Next Page"
          >
            <ChevronRightIcon size={14} />
          </button>
        </form>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* Zoom Controls */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={onZoomOut}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10 transition"
            title="Zoom Out"
          >
            <MinusIcon size={14} />
          </button>

          <button
            type="button"
            onClick={onToggleFitWidth}
            className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
              fitWidth
                ? "bg-brand-50 text-brand-700 ring-1 ring-brand-500/20 dark:bg-brand-950 dark:text-brand-300"
                : "text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
            title="Toggle Fit to Width"
          >
            {fitWidth ? "Fit Width" : `${Math.round(scale * 100)}%`}
          </button>

          <button
            type="button"
            onClick={onZoomIn}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10 transition"
            title="Zoom In"
          >
            <PlusIcon size={14} />
          </button>
        </div>
      </div>

      {/* Right Section: Tools, Search, Themes & AI Companion */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Desktop-only Bookmark Button */}
        <button
          type="button"
          onClick={onToggleBookmark}
          className={`hidden md:flex h-8 w-8 items-center justify-center rounded-xl transition ${
            isBookmarked
              ? "bg-amber-500 text-white shadow-sm shadow-amber-500/25 scale-105"
              : "text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"
          }`}
          title={isBookmarked ? `Remove bookmark from Page ${currentPage}` : `Bookmark Page ${currentPage}`}
        >
          <BookmarkIcon size={16} filled={isBookmarked} />
        </button>

        {/* Desktop-only Add Note Button */}
        {onAddNote && (
          <button
            type="button"
            onClick={onAddNote}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10 transition"
            title={`Add Note for Page ${currentPage}`}
          >
            <FileTextIcon size={16} />
          </button>
        )}

        {/* Document Search (Desktop & Mobile) */}
        <button
          type="button"
          onClick={onToggleSearch}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
            searchOpen
              ? "bg-brand-600 text-white shadow-sm shadow-brand-500/25"
              : "text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"
          }`}
          title="Search Document (Cmd+F / Ctrl+F)"
        >
          <SearchIcon size={16} />
        </button>

        {/* Mobile Single Theme Cycle Button */}
        <button
          type="button"
          onClick={handleCycleTheme}
          className="flex md:hidden h-8 w-8 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 active:scale-95 transition"
          title={`Current Theme: ${theme}. Tap to switch.`}
        >
          {theme === "light" && <SunIcon size={15} className="text-amber-500" />}
          {theme === "sepia" && <span className="text-xs font-black text-[#5c4731]">S</span>}
          {theme === "dark" && <MoonIcon size={15} className="text-amber-300" />}
        </button>

        {/* Desktop 3-Theme Selector */}
        <div className="hidden md:flex items-center rounded-xl bg-slate-100/80 p-0.5 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => onThemeChange("light")}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              theme === "light"
                ? "bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300 font-bold"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
            title="Light Theme"
          >
            <SunIcon size={13} />
          </button>
          <button
            type="button"
            onClick={() => onThemeChange("sepia")}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              theme === "sepia"
                ? "bg-[#e8dec8] text-[#433422] shadow-sm font-bold"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
            title="Warm Sepia Theme"
          >
            <span className="text-[11px] font-black">S</span>
          </button>
          <button
            type="button"
            onClick={() => onThemeChange("dark")}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              theme === "dark"
                ? "bg-slate-900 text-amber-300 shadow-sm font-bold"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
            title="Night Dark Theme"
          >
            <MoonIcon size={13} />
          </button>
        </div>

        {/* Desktop Fullscreen Toggle */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10 transition"
          title="Fullscreen Mode"
        >
          <MaximizeIcon size={16} />
        </button>

        {/* Acrobat-Style AI Companion Trigger Button */}
        <button
          type="button"
          onClick={onToggleAiDrawer}
          className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-xs font-bold transition-all duration-200 ${
            aiDrawerOpen
              ? "bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/30 scale-[1.02]"
              : "bg-gradient-to-r from-brand-500/10 to-indigo-500/10 text-brand-700 hover:from-brand-500/20 hover:to-indigo-500/20 dark:from-brand-400/20 dark:to-indigo-400/20 dark:text-brand-300 ring-1 ring-brand-500/20"
          }`}
          title="Open Adobe AI Assistant"
        >
          <SparklesIcon size={14} className="animate-pulse" />
          <span className="hidden sm:inline">AI Tutor</span>
        </button>
      </div>
    </header>
  );
}
