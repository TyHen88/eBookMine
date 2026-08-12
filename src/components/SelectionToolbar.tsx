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
}

export default function SelectionToolbar({
  position,
  selectedText,
  onHighlight,
  onAddNote,
  onAiAction,
  onClose,
}: SelectionToolbarProps) {
  if (!position || !selectedText.trim()) return null;

  return (
    <div
      role="toolbar"
      aria-label="Text selection actions"
      style={{
        top: `${Math.max(60, position.top - 50)}px`,
        left: `${Math.max(10, position.left - 150)}px`,
      }}
      className="fixed z-50 flex animate-fade-in items-center gap-1 rounded-xl border border-slate-200/80 bg-white/95 px-2 py-1.5 shadow-xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/95"
    >
      <button
        type="button"
        onClick={() => onHighlight(selectedText)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/50"
      >
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        Highlight
      </button>

      <button
        type="button"
        onClick={() => onAddNote(selectedText)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <BookmarkIcon size={13} />
        Add Note
      </button>

      <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-800" />

      <button
        type="button"
        onClick={() => onAiAction("explain", selectedText)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/50"
      >
        <SparklesIcon size={13} />
        Explain
      </button>

      <button
        type="button"
        onClick={() => onAiAction("simplify", selectedText)}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        Simplify
      </button>

      <button
        type="button"
        onClick={() => onAiAction("translate", selectedText)}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        Translate
      </button>

      <button
        type="button"
        onClick={() => onAiAction("ask", selectedText)}
        className="flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-300"
      >
        <SparklesIcon size={12} />
        Ask AI
      </button>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close selection menu"
        className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
