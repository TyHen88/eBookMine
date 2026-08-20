"use client";

import React, { useState, useEffect } from "react";
import { DocumentTab } from "./context/ReaderTabContext";
import { NoteData } from "@/lib/readingService";
import {
  BookmarkIcon,
  XIcon,
  TrashIcon,
  PlusIcon,
  FileTextIcon,
} from "@/components/ui/icons";

interface ReaderSidebarProps {
  tab: DocumentTab;
  pdfDoc: any;
  isOpen: boolean;
  onClose: () => void;
  onJumpToPage: (page: number) => void;
  onDeleteBookmark: (id: string) => void;
  onDeleteHighlight: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onEditNote?: (note: NoteData) => void;
  onAddNote?: (page: number) => void;
}

type TabType = "toc" | "bookmarks" | "highlights" | "notes";

interface TocItem {
  title: string;
  page?: number;
  items?: TocItem[];
}

export default function ReaderSidebar({
  tab,
  pdfDoc,
  isOpen,
  onClose,
  onJumpToPage,
  onDeleteBookmark,
  onDeleteHighlight,
  onDeleteNote,
  onEditNote,
  onAddNote,
}: ReaderSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("toc");
  const [outline, setOutline] = useState<TocItem[]>([]);
  const [loadingOutline, setLoadingOutline] = useState(false);

  // Extract PDF outline / table of contents
  useEffect(() => {
    if (!pdfDoc) return;
    let isMounted = true;

    const extractOutline = async () => {
      try {
        setLoadingOutline(true);
        const rawOutline = await pdfDoc.getOutline();
        if (!rawOutline || rawOutline.length === 0) {
          if (isMounted) setOutline([]);
          return;
        }

        const parsedItems: TocItem[] = [];
        for (const item of rawOutline) {
          let pageNumber: number | undefined;
          if (item.dest) {
            try {
              let dest = item.dest;
              if (typeof dest === "string") {
                dest = await pdfDoc.getDestination(dest);
              }
              if (Array.isArray(dest) && dest[0]) {
                const pageIdx = await pdfDoc.getPageIndex(dest[0]);
                pageNumber = pageIdx + 1;
              }
            } catch {
              /* fallback */
            }
          }
          parsedItems.push({
            title: item.title,
            page: pageNumber,
          });
        }

        if (isMounted) setOutline(parsedItems);
      } catch (err) {
        console.warn("Failed to extract PDF outline:", err);
      } finally {
        if (isMounted) setLoadingOutline(false);
      }
    };

    extractOutline();
    return () => {
      isMounted = false;
    };
  }, [pdfDoc]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-fadeIn"
        onClick={onClose}
      />

      <aside className="fixed inset-y-0 left-0 z-50 flex h-full w-[88vw] max-w-xs md:relative md:inset-auto md:z-30 md:w-72 lg:w-80 flex-col border-r border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 transition-all animate-slideRight">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 p-3.5 dark:border-slate-800">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
          Document Overview
        </h3>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          aria-label="Close Sidebar"
        >
          <XIcon size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-900/60">
        <button
          onClick={() => setActiveTab("toc")}
          className={`flex-1 rounded-xl py-1.5 text-center text-[11px] font-bold transition ${
            activeTab === "toc"
              ? "bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          Contents
        </button>
        <button
          onClick={() => setActiveTab("bookmarks")}
          className={`flex-1 rounded-xl py-1.5 text-center text-[11px] font-bold transition ${
            activeTab === "bookmarks"
              ? "bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          Bookmarks ({tab.bookmarks?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("highlights")}
          className={`flex-1 rounded-xl py-1.5 text-center text-[11px] font-bold transition ${
            activeTab === "highlights"
              ? "bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          Highlights
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`flex-1 rounded-xl py-1.5 text-center text-[11px] font-bold transition ${
            activeTab === "notes"
              ? "bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          Notes
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Table of Contents */}
        {activeTab === "toc" && (
          <div className="space-y-1">
            {loadingOutline ? (
              <p className="p-4 text-center text-xs text-slate-400">
                Loading table of contents...
              </p>
            ) : outline.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">
                No embedded table of contents found in this document.
              </p>
            ) : (
              outline.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => item.page && onJumpToPage(item.page)}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                >
                  <span className="truncate pr-2">{item.title}</span>
                  {item.page && (
                    <span className="shrink-0 text-[10px] text-slate-400">
                      P. {item.page}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* Bookmarks */}
        {activeTab === "bookmarks" && (
          <div className="space-y-1.5">
            {(!tab.bookmarks || tab.bookmarks.length === 0) ? (
              <p className="p-4 text-center text-xs text-slate-400">
                No bookmarks yet. Add one from the reader toolbar or page badge.
              </p>
            ) : (
              tab.bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => onJumpToPage(bm.page)}
                  className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-white p-2.5 text-xs shadow-sm hover:border-brand-400 dark:border-slate-800 dark:bg-slate-800/80 transition"
                >
                  <div className="flex items-center gap-2">
                    <BookmarkIcon size={14} className="text-amber-500" />
                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-white">
                        {bm.title || `Page ${bm.page}`}
                      </h5>
                      <span className="text-[10px] text-slate-400">
                        Page {bm.page}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBookmark(bm.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition"
                    title="Delete bookmark"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Highlights */}
        {activeTab === "highlights" && (
          <div className="space-y-2">
            {(!tab.highlights || tab.highlights.length === 0) ? (
              <p className="p-4 text-center text-xs text-slate-400">
                No highlights yet. Select any text in the PDF to highlight it.
              </p>
            ) : (
              tab.highlights.map((h) => (
                <div
                  key={h.id}
                  onClick={() => onJumpToPage(h.page)}
                  className="group flex cursor-pointer flex-col gap-1 rounded-xl border border-slate-100 bg-white p-2.5 text-xs shadow-sm hover:border-brand-400 dark:border-slate-800 dark:bg-slate-800/80 transition"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-brand-600 dark:text-brand-400">
                      Page {h.page}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteHighlight(h.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                  <p className="line-clamp-3 text-xs italic text-slate-700 dark:text-slate-300">
                    &ldquo;{h.selectedText}&rdquo;
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Notes */}
        {activeTab === "notes" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Notes ({tab.notes?.length || 0})
              </span>
              {onAddNote && (
                <button
                  type="button"
                  onClick={() => onAddNote(tab.currentPage || 1)}
                  className="flex items-center gap-1 rounded-lg bg-brand-500/10 px-2 py-1 text-[11px] font-bold text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 hover:bg-brand-500/20 active:scale-95 transition"
                >
                  <PlusIcon size={12} />
                  <span>New Note</span>
                </button>
              )}
            </div>

            {(!tab.notes || tab.notes.length === 0) ? (
              <div className="py-6 text-center text-xs text-slate-400 space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 text-slate-400">
                  <FileTextIcon size={20} />
                </div>
                <p>No notes created yet.</p>
                {onAddNote && (
                  <button
                    type="button"
                    onClick={() => onAddNote(tab.currentPage || 1)}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    + Add note for Page {tab.currentPage || 1}
                  </button>
                )}
              </div>
            ) : (
              tab.notes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (onEditNote) {
                      onEditNote(n);
                    } else {
                      onJumpToPage(n.page);
                    }
                  }}
                  className="group flex cursor-pointer flex-col gap-1.5 rounded-xl border border-slate-100 bg-white p-2.5 text-xs shadow-sm hover:border-brand-400 dark:border-slate-800 dark:bg-slate-800/80 transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onJumpToPage(n.page);
                      }}
                      className="font-bold text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Page {n.page}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditNote) onEditNote(n);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-brand-600 transition text-[10px] font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNote(n.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition"
                        title="Delete note"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-4 whitespace-pre-wrap">
                    {n.content}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
