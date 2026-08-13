"use client";

import React from "react";
import {
  SparklesIcon,
  BookmarkIcon,
  XIcon,
} from "./ui/icons";

export interface SelectionToolbarProps {
  position: { top: number; left: number } | null;
  selectedText: string;
  onHighlight: (text: string) => void;
  onAddNote: (text: string) => void;
  onAiAction: (actionType: "explain" | "simplify" | "translate" | "ask", text: string) => void;
  onClose: () => void;
  theme?: "light" | "dark" | "sepia";
}

export default function SelectionToolbar({
  position,
  selectedText,
  onHighlight,
  onAddNote,
  onAiAction,
  onClose,
  theme = "light",
}: SelectionToolbarProps) {
  if (!position || !selectedText.trim()) return null;

  // Theme-specific styles
  let containerStyles = "border-slate-200/80 bg-white/95 text-slate-800 dark:border-slate-800/80 dark:bg-slate-900/95 dark:text-slate-100";
  let btnHighlight = "text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/50";
  let btnStandard = "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";
  let btnBrand = "text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/50";
  let btnAskAi = "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-300";
  let divider = "bg-slate-200 dark:bg-slate-800";
  let btnClose = "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200";

  if (theme === "sepia") {
    containerStyles = "border-[#e2cf9f] bg-[#f4e4c1]/95 text-[#5c4b37]";
    btnHighlight = "text-[#8c6d12] hover:bg-[#ebd9b3]";
    btnStandard = "text-[#5c4b37] hover:bg-[#ebd9b3]";
    btnBrand = "text-indigo-800 hover:bg-indigo-100/50";
    btnAskAi = "bg-[#ebd9b3] text-indigo-900 hover:bg-[#e2cf9f]";
    divider = "bg-[#e2cf9f]";
    btnClose = "text-[#9e876a] hover:text-[#5c4b37]";
  } else if (theme === "dark") {
    containerStyles = "border-slate-800/80 bg-slate-900/95 text-slate-100";
    btnHighlight = "text-amber-300 hover:bg-amber-950/50";
    btnStandard = "text-slate-200 hover:bg-slate-800";
    btnBrand = "text-brand-400 hover:bg-brand-950/50";
    btnAskAi = "bg-brand-950/60 text-brand-300 hover:bg-brand-900/60";
    divider = "bg-slate-800";
    btnClose = "text-slate-500 hover:text-slate-200";
  }

  // Adjust left position dynamically to prevent offscreen rendering
  const leftPos = typeof window !== "undefined"
    ? Math.max(10, Math.min(window.innerWidth - 330, position.left - 150))
    : position.left - 150;

  return (
    <div
      role="toolbar"
      aria-label="Text selection actions"
      style={{
        top: `${Math.max(60, position.top - 55)}px`,
        left: `${leftPos}px`,
      }}
      className={`fixed z-50 flex max-w-[95vw] sm:max-w-none flex-wrap animate-fade-in items-center gap-1 rounded-xl border p-1.5 shadow-xl backdrop-blur-xl ${containerStyles}`}
    >
      <button
        type="button"
        onClick={() => onHighlight(selectedText)}
        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${btnHighlight}`}
      >
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        Highlight
      </button>

      <button
        type="button"
        onClick={() => onAddNote(selectedText)}
        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${btnStandard}`}
      >
        <BookmarkIcon size={13} />
        Add Note
      </button>

      <div className={`mx-0.5 h-4 w-px ${divider}`} />

      <button
        type="button"
        onClick={() => onAiAction("explain", selectedText)}
        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${btnBrand}`}
      >
        <SparklesIcon size={13} />
        Explain
      </button>

      <button
        type="button"
        onClick={() => onAiAction("simplify", selectedText)}
        className={`rounded-lg px-2 py-1 text-xs font-semibold ${btnStandard}`}
      >
        Simplify
      </button>

      <button
        type="button"
        onClick={() => onAiAction("translate", selectedText)}
        className={`rounded-lg px-2 py-1 text-xs font-semibold ${btnStandard}`}
      >
        Translate
      </button>

      <button
        type="button"
        onClick={() => onAiAction("ask", selectedText)}
        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${btnAskAi}`}
      >
        <SparklesIcon size={12} />
        Ask AI
      </button>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close selection menu"
        className={`ml-1 p-0.5 rounded ${btnClose}`}
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
