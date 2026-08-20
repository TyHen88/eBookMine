"use client";

import React from "react";
import { useReaderTabs } from "./context/ReaderTabContext";
import { BookOpenIcon, PlusIcon, XIcon, CheckIcon } from "@/components/ui/icons";
import BookThumbnailImg from "@/components/BookThumbnailImg";
import { Button } from "@/components/ui";

interface MobileTabSwitcherSheetProps {
  isOpen: boolean;
  theme?: "light" | "dark" | "sepia";
  onClose: () => void;
}

export default function MobileTabSwitcherSheet({
  isOpen,
  theme = "light",
  onClose,
}: MobileTabSwitcherSheetProps) {
  const { tabs, activeTabId, setActiveTabId, closeTab, setQuickPickerOpen } =
    useReaderTabs();

  if (!isOpen) return null;

  const isDark = theme === "dark";
  const isSepia = theme === "sepia";

  const containerBg = isDark
    ? "bg-slate-900 border-slate-700/80 text-white"
    : isSepia
    ? "bg-[#f4ecd8] border-[#d8cdb4] text-[#433422]"
    : "bg-white border-slate-200 text-slate-900";

  const dragHandleBg = isDark
    ? "bg-slate-700"
    : isSepia
    ? "bg-[#d8cdb4]"
    : "bg-slate-300";

  const titleColor = isDark
    ? "text-white"
    : isSepia
    ? "text-[#433422]"
    : "text-slate-900";

  const subtitleColor = isDark
    ? "text-slate-400"
    : isSepia
    ? "text-[#7b6751]"
    : "text-slate-500";

  const cardNormal = isDark
    ? "border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-white"
    : isSepia
    ? "border-[#d8cdb4] bg-[#fdfaf3] hover:bg-[#f7f0e0] text-[#433422]"
    : "border-slate-200/90 bg-white hover:bg-slate-50 text-slate-900";

  const cardActive = isDark
    ? "border-brand-500 bg-brand-950/40 shadow-md ring-1 ring-brand-500/30 text-white"
    : isSepia
    ? "border-[#a1783f] bg-[#ebd9bd]/70 shadow-md ring-1 ring-[#a1783f]/40 text-[#433422]"
    : "border-brand-400 bg-brand-50/70 shadow-sm ring-1 ring-brand-400/30 text-slate-900";

  const closeButtonBg = isDark
    ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
    : isSepia
    ? "bg-[#ebd9bd] text-[#5c4731] hover:bg-[#ded3bc] hover:text-[#433422]"
    : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm md:hidden animate-fadeIn">
      {/* Tap backdrop to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Slide-Up Sheet Panel */}
      <div className={`relative max-h-[80vh] w-full rounded-t-3xl border-t shadow-2xl p-5 space-y-4 overflow-y-auto animate-slideUp ${containerBg}`}>
        {/* Swipe / Drag Pill Handle */}
        <div className={`mx-auto h-1.5 w-12 rounded-full ${dragHandleBg}`} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/20 text-brand-500">
              <BookOpenIcon size={16} />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${titleColor}`}>Open Documents</h3>
              <p className={`text-[11px] ${subtitleColor}`}>
                {tabs.length} {tabs.length === 1 ? "book" : "books"} in workspace
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${closeButtonBg}`}
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Tab Cards List */}
        <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const percent =
              tab.pageCount > 0
                ? Math.min(100, Math.round(((tab.currentPage || 1) / tab.pageCount) * 100))
                : 0;

            return (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  onClose();
                }}
                className={`flex items-center gap-3 rounded-2xl border p-3 cursor-pointer transition-all active:scale-[0.99] ${
                  isActive ? cardActive : cardNormal
                }`}
              >
                {/* Book Thumbnail */}
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-black/5 dark:bg-white/10 shadow-inner">
                  <BookThumbnailImg
                    bookId={tab.id}
                    cover={tab.cover}
                    title={tab.title}
                    className="h-full w-full"
                  />
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className={`line-clamp-1 text-xs font-bold ${titleColor}`}>
                      {tab.title}
                    </h4>
                    {isActive && (
                      <span className="flex items-center gap-1 rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-300">
                        <CheckIcon size={10} strokeWidth={3} />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  <p className={`line-clamp-1 text-[10px] ${subtitleColor}`}>
                    {tab.author || "Unknown Author"}
                  </p>

                  <div className="pt-0.5">
                    <div className={`flex items-center justify-between text-[10px] mb-0.5 ${subtitleColor}`}>
                      <span>Page {tab.currentPage || 1} of {tab.pageCount || "…"}</span>
                      <span className="font-semibold text-brand-500">{percent}%</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 to-indigo-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${closeButtonBg}`}
                  title="Close Tab"
                >
                  <XIcon size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add New Book Button */}
        <Button
          onClick={() => {
            onClose();
            setQuickPickerOpen(true);
          }}
          size="md"
          className="w-full justify-center gap-2 py-3 rounded-2xl font-bold shadow-lg"
        >
          <PlusIcon size={16} />
          <span>Open Another Book in New Tab</span>
        </Button>
      </div>
    </div>
  );
}
