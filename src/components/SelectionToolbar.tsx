"use client";

import React, { useState } from "react";
import {
  SparklesIcon,
  BookmarkIcon,
  DotsVerticalIcon,
  CopyIcon,
  TranslateIcon,
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
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const toolbarRef = React.useRef<HTMLDivElement>(null);

  // Close toolbar when clicking or tapping outside, or pressing Escape
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Attach with small delay so the pointerUp that triggered selection doesn't instantly dismiss it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick, { passive: true });
      document.addEventListener("keydown", handleKeyDown);
    }, 60);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!position || !selectedText.trim()) return null;

  // Theme-specific styles
  let containerStyles = "border-slate-200/90 bg-white/95 text-slate-800 dark:border-slate-800/90 dark:bg-slate-900/95 dark:text-slate-100";
  let btnHighlight = "text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/50";
  let btnStandard = "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";
  let btnBrand = "text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/50";
  let btnAskAi = "bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 shadow-sm";
  let divider = "bg-slate-200 dark:bg-slate-800";
  let menuStyles = "bg-white border-slate-200 shadow-2xl dark:bg-slate-900 dark:border-slate-800";

  if (theme === "sepia") {
    containerStyles = "border-[#e2cf9f] bg-[#f4e4c1]/95 text-[#5c4b37]";
    btnHighlight = "text-[#8c6d12] hover:bg-[#ebd9b3]";
    btnStandard = "text-[#5c4b37] hover:bg-[#ebd9b3]";
    btnBrand = "text-indigo-800 hover:bg-indigo-100/50";
    btnAskAi = "bg-[#5c4b37] text-white hover:bg-[#4a3c2c]";
    divider = "bg-[#e2cf9f]";
    menuStyles = "bg-[#f4e4c1] border-[#e2cf9f]";
  } else if (theme === "dark") {
    containerStyles = "border-slate-800/90 bg-slate-900/95 text-slate-100";
    btnHighlight = "text-amber-300 hover:bg-amber-950/50";
    btnStandard = "text-slate-200 hover:bg-slate-800";
    btnBrand = "text-brand-400 hover:bg-brand-950/50";
    btnAskAi = "bg-brand-500 text-white hover:bg-brand-600 shadow-sm";
    divider = "bg-slate-800";
    menuStyles = "bg-slate-900 border-slate-800";
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(selectedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // Calculate precise positioning anchored directly over selected text / box
  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 600;
  const toolbarWidth = 290;

  const validLeft = position.left && position.left > 0 ? position.left : windowWidth / 2;
  const validTop = position.top && position.top > 0 ? position.top : 120;

  const clampLeft = Math.max(12, Math.min(windowWidth - toolbarWidth - 12, validLeft - toolbarWidth / 2));
  const topPos = validTop < 90 ? validTop + 40 : validTop - 52;

  const styleObj: React.CSSProperties = {
    top: `${topPos}px`,
    left: `${clampLeft}px`,
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text selection actions"
      style={styleObj}
      className={`fixed z-50 flex items-center gap-1 rounded-2xl border p-1 shadow-2xl backdrop-blur-xl transition-all duration-200 ${containerStyles}`}
    >
      {/* 1. Highlight */}
      <button
        type="button"
        onClick={() => onHighlight(selectedText)}
        className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all ${btnHighlight}`}
        title="Highlight selected text"
      >
        <span className="h-3 w-3 rounded-full bg-amber-400 shrink-0 shadow-sm" />
        <span>Highlight</span>
      </button>

      {/* 2. Translate */}
      <button
        type="button"
        onClick={() => onAiAction("translate", selectedText)}
        className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all ${btnStandard}`}
        title="Translate text"
      >
        <TranslateIcon size={14} />
        <span>Translate</span>
      </button>

      {/* 3. Ask AI */}
      <button
        type="button"
        onClick={() => onAiAction("ask", selectedText)}
        className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all ${btnAskAi}`}
        title="Ask AI about selected text"
      >
        <SparklesIcon size={13} />
        <span>Ask AI</span>
      </button>

      <div className={`mx-0.5 h-4 w-px ${divider}`} />

      {/* 4. More Tools Menu Toggle (⋮) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className={`flex items-center justify-center rounded-xl p-1.5 text-xs font-bold transition-all ${
            showMore ? "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300" : btnStandard
          }`}
          title="More tools (Add note, Explain, Simplify, Copy)"
        >
          <DotsVerticalIcon size={16} />
        </button>

        {/* Dropdown Menu (Opens Upward or Downward based on screen position) */}
        {showMore && (
          <div
            className={`absolute right-0 z-50 flex w-40 flex-col gap-0.5 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl animate-pop-in ${
              position.top > 200 ? "bottom-full mb-1.5" : "top-full mt-1.5"
            } ${menuStyles}`}
          >
            <button
              type="button"
              onClick={() => {
                setShowMore(false);
                onAddNote(selectedText);
              }}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold ${btnStandard}`}
            >
              <BookmarkIcon size={14} />
              <span>Add Note</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowMore(false);
                onAiAction("explain", selectedText);
              }}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold ${btnBrand}`}
            >
              <SparklesIcon size={14} />
              <span>Explain</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowMore(false);
                onAiAction("simplify", selectedText);
              }}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold ${btnStandard}`}
            >
              <span>⚡ Simplify</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold ${btnStandard}`}
            >
              <CopyIcon size={14} />
              <span>{copied ? "Copied!" : "Copy Text"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
