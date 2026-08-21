"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  SparklesIcon,
  TranslateIcon,
  VolumeIcon,
  TagIcon,
  XIcon,
  CheckIcon,
} from "@/components/ui/icons";

interface SelectionHUDProps {
  selectedText: string;
  position: { top: number; left: number };
  page: number;
  onClose: () => void;
  onExplain: (text: string, page: number, position?: { top: number; left: number }) => void;
  onSimplify: (text: string, page: number, position?: { top: number; left: number }) => void;
  onTranslate: (text: string, page: number) => void;
  onAddHighlight: (text: string, color: string, page: number) => void;
  onAddNote: (text: string, page: number) => void;
  onPlayTTS: (text: string) => void;
}

const HIGHLIGHT_COLORS = [
  { name: "yellow", bg: "bg-amber-300 dark:bg-amber-400" },
  { name: "green", bg: "bg-emerald-400 dark:bg-emerald-400" },
  { name: "blue", bg: "bg-sky-400 dark:bg-sky-400" },
  { name: "purple", bg: "bg-purple-400 dark:bg-purple-400" },
  { name: "pink", bg: "bg-pink-400 dark:bg-pink-400" },
];

export default function SelectionHUD({
  selectedText,
  position,
  page,
  onClose,
  onExplain,
  onSimplify,
  onTranslate,
  onAddHighlight,
  onAddNote,
  onPlayTTS,
}: SelectionHUDProps) {
  const hudRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeBelow: boolean }>({
    top: position.top,
    left: position.left,
    placeBelow: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hud = hudRef.current;
    const hudW = hud ? hud.offsetWidth : 360;
    const hudH = hud ? hud.offsetHeight : 44;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const halfW = hudW / 2;
    const margin = 12;

    let targetLeft = position.left;
    if (targetLeft - halfW < margin) {
      targetLeft = halfW + margin;
    } else if (targetLeft + halfW > vw - margin) {
      targetLeft = vw - halfW - margin;
    }

    let placeBelow = false;
    let targetTop = position.top - 12;

    // If top of HUD would collide with header (< 58px), place below the selection
    if (targetTop - hudH < 58) {
      targetTop = position.top + 32;
      placeBelow = true;
    } else if (targetTop > vh - 60) {
      targetTop = vh - 70;
      placeBelow = false;
    }

    setCoords({ top: targetTop, left: targetLeft, placeBelow });
  }, [position, selectedText]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (hudRef.current && !hudRef.current.contains(e.target as Node)) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.toString().trim().length < 2) {
          onClose();
        }
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!selectedText) return null;

  return (
    <div
      ref={hudRef}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        transform: coords.placeBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      }}
      className="fixed z-50 flex max-w-[96vw] items-center gap-0.5 sm:gap-1 overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-900/95 p-1 sm:p-1.5 text-white shadow-2xl backdrop-blur-xl animate-scaleUp select-none scrollbar-none"
    >
      {/* Explain */}
      <button
        type="button"
        onClick={() => {
          onExplain(selectedText, page, position);
          onClose();
        }}
        className="flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs font-bold text-amber-300 hover:bg-white/10 active:scale-95 transition"
        title="Explain with AI"
      >
        <SparklesIcon size={13} />
        <span>Explain</span>
      </button>

      {/* Simplify */}
      <button
        type="button"
        onClick={() => {
          onSimplify(selectedText, page, position);
          onClose();
        }}
        className="flex shrink-0 items-center gap-1 rounded-xl px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs font-semibold text-slate-200 hover:bg-white/10 active:scale-95 transition"
        title="Simplify Text"
      >
        <span>Simplify</span>
      </button>

      {/* Translate */}
      <button
        type="button"
        onClick={() => {
          onTranslate(selectedText, page);
          onClose();
        }}
        className="flex shrink-0 items-center gap-1 rounded-xl px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs font-semibold text-blue-300 hover:bg-white/10 active:scale-95 transition"
        title="Translate with Google Translate"
      >
        <TranslateIcon size={13} />
        <span>Translate</span>
      </button>

      {/* Highlighting */}
      <div className="flex items-center gap-1 shrink-0 rounded-xl bg-white/5 px-1 py-0.5 border border-white/10">
        <button
          type="button"
          onClick={() => {
            onAddHighlight(selectedText, "yellow", page);
            onClose();
          }}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs font-bold text-amber-300 hover:bg-white/10 active:scale-95 transition"
          title="Highlight in Yellow"
        >
          <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-amber-400 shadow-sm" />
          <span>Highlight</span>
        </button>

        <div className="flex items-center gap-1 pl-0.5 pr-1">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                onAddHighlight(selectedText, c.name, page);
                onClose();
              }}
              className={`h-4 w-4 sm:h-4.5 sm:w-4.5 rounded-full ${c.bg} shadow-sm hover:scale-125 active:scale-90 transition-transform`}
              title={`Highlight in ${c.name}`}
            />
          ))}
        </div>
      </div>

      {/* Add Note */}
      <button
        type="button"
        onClick={() => {
          onAddNote(selectedText, page);
          onClose();
        }}
        className="flex shrink-0 items-center gap-1 rounded-xl px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs font-semibold text-slate-200 hover:bg-white/10 active:scale-95 transition"
        title="Add Margin Note"
      >
        <TagIcon size={12} />
        <span>Note</span>
      </button>

      {/* TTS Audio */}
      <button
        type="button"
        onClick={() => {
          onPlayTTS(selectedText);
          onClose();
        }}
        className="flex shrink-0 h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-xl text-purple-300 hover:bg-white/10 active:scale-95 transition"
        title="Listen to Speech"
      >
        <VolumeIcon size={13} />
      </button>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="flex shrink-0 h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
        title="Close Menu"
      >
        <XIcon size={12} />
      </button>
    </div>
  );
}
