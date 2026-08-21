"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  SparklesIcon,
  XIcon,
  CopyIcon,
  CheckIcon,
  VolumeIcon,
  TagIcon,
  RotateCwIcon,
} from "@/components/ui/icons";
import { Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

export interface AiActionModalProps {
  isOpen: boolean;
  actionType: "explain" | "simplify";
  selectedText: string;
  page: number;
  position?: { top: number; left: number };
  bookTitle?: string;
  author?: string;
  theme?: "light" | "dark" | "sepia";
  onClose: () => void;
  onSaveAsNote?: (content: string, page: number) => void;
  onAskAiInDrawer?: (prompt: string) => void;
  onPlayTTS?: (text: string) => void;
}

export default function AiActionModal({
  isOpen,
  actionType,
  selectedText,
  page,
  position,
  bookTitle = "Document",
  author,
  theme = "light",
  onClose,
  onSaveAsNote,
  onPlayTTS,
}: AiActionModalProps) {
  const { showToast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [fullContent, setFullContent] = useState("");
  const [displayedContent, setDisplayedContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isDark = theme === "dark";
  const isSepia = theme === "sepia";

  // Calculate dynamic coordinate above selected message with useMemo
  const coords = useMemo(() => {
    if (typeof window === "undefined") {
      return { placeBelow: false, isMobile: true };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 640;

    if (isMobile || !position) {
      return { placeBelow: false, isMobile: true };
    }

    const cardW = 440;
    const cardH = 220; // Estimated baseline height
    const halfW = cardW / 2;
    const margin = 16;

    let targetLeft = position.left;
    if (targetLeft - halfW < margin) {
      targetLeft = halfW + margin;
    } else if (targetLeft + halfW > vw - margin) {
      targetLeft = vw - halfW - margin;
    }

    let placeBelow = false;
    let targetTop = position.top - 14;

    // If top position would collide with top header (< 60px), flip below selection
    if (targetTop - cardH < 60) {
      targetTop = position.top + 32;
      placeBelow = true;
    } else if (targetTop > vh - 60) {
      targetTop = vh - 80;
      placeBelow = false;
    }

    return {
      top: targetTop,
      left: targetLeft,
      placeBelow,
      isMobile: false,
    };
  }, [position]);

  // Outside click & Escape listener
  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
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

  // Typewriter streaming animation helper
  const startTypewriterAnimation = useCallback((targetText: string) => {
    setIsTyping(true);
    let index = 0;
    const length = targetText.length;
    const chunkSize = Math.max(3, Math.floor(length / 70));

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);

    typingTimerRef.current = setInterval(() => {
      index += chunkSize;
      if (index >= length) {
        setDisplayedContent(targetText);
        setIsTyping(false);
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      } else {
        setDisplayedContent(targetText.slice(0, index));
      }
    }, 16);
  }, []);

  // Fetch AI Response
  const fetchAiResponse = useCallback(async () => {
    if (!selectedText.trim()) return;

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setFullContent("");
    setDisplayedContent("");
    setIsTyping(false);

    try {
      const res = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          text: selectedText,
          page,
          bookTitle,
          author,
          targetLang: "km",
          targetLangName: "Khmer",
        }),
        signal: abortControllerRef.current.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate AI response");
      }

      const textResult = data.result || data.explanation || data.content || "No explanation provided.";
      setFullContent(textResult);
      setLoading(false);

      // Start Stream Typing Animation
      startTypewriterAnimation(textResult);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Could not connect to AI service.");
      setLoading(false);
    }
  }, [selectedText, actionType, page, bookTitle, author, startTypewriterAnimation]);

  const skipTyping = () => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setDisplayedContent(fullContent);
    setIsTyping(false);
  };

  useEffect(() => {
    let isMounted = true;
    if (isOpen && selectedText) {
      const timer = setTimeout(() => {
        if (isMounted) fetchAiResponse();
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
        if (abortControllerRef.current) abortControllerRef.current.abort();
      };
    }
    return () => {
      isMounted = false;
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [isOpen, selectedText, fetchAiResponse]);

  // Handle Copy to Clipboard
  const handleCopy = async () => {
    const textToCopy = fullContent.replace(/===SPLIT_LANG_EXPLANATION===/g, "\n\n---\n\n");
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      showToast("Copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy text", "error");
    }
  };

  // Handle Save As Margin Note
  const handleSaveNote = () => {
    if (!onSaveAsNote || !fullContent) return;
    const noteText = `[AI ${actionType === "explain" ? "Explanation" : "Simplification"} of "${selectedText.slice(0, 50)}..."]:\n\n${fullContent.replace(/===SPLIT_LANG_EXPLANATION===/g, "\n\n")}`;
    onSaveAsNote(noteText, page);
    showToast("Saved as Margin Note", "success");
  };

  // Handle TTS Audio Listen
  const handleTTS = () => {
    if (onPlayTTS && displayedContent) {
      const cleanText = displayedContent
        .replace(/===SPLIT_LANG_EXPLANATION===/g, ". ")
        .replace(/[#*`>•-]/g, "")
        .slice(0, 600);
      onPlayTTS(cleanText);
    }
  };

  // Card Theme Styling
  const cardBg = isDark
    ? "bg-slate-900/95 border-slate-700/80 text-white shadow-slate-950/70"
    : isSepia
    ? "bg-[#f4ecd8]/95 border-[#d8cdb4] text-[#433422] shadow-[#6c593f]/25"
    : "bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-900/20";

  const footerBorder = isDark
    ? "border-slate-800"
    : isSepia
    ? "border-[#d8cdb4]/70"
    : "border-slate-100";

  const iconButtonHover = isDark
    ? "text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/15"
    : isSepia
    ? "text-[#7b6751] hover:text-[#433422] hover:bg-black/5 active:bg-black/10"
    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200";

  if (!isOpen) return null;

  // Compute inline positioning style
  const positionStyle: React.CSSProperties = coords.isMobile
    ? {
        position: "fixed",
        bottom: "76px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100vw - 24px)",
        maxWidth: "420px",
      }
    : {
        position: "fixed",
        top: coords.top !== undefined ? `${coords.top}px` : "50%",
        left: coords.left !== undefined ? `${coords.left}px` : "50%",
        transform:
          coords.top !== undefined
            ? coords.placeBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)"
            : "translate(-50%, -50%)",
        width: "440px",
        maxWidth: "94vw",
      };

  return (
    <aside
      ref={cardRef}
      role="region"
      aria-label="AI response message"
      style={positionStyle}
      className={`z-50 flex flex-col max-h-[65vh] sm:max-h-[55vh] rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-200 animate-scaleUp select-text ${cardBg}`}
    >
      {/* 1. Message Body (No Top Header) */}
      <div
        onClick={isTyping ? skipTyping : undefined}
        className="flex-1 overflow-y-auto px-4 py-3.5 space-y-2 text-xs sm:text-sm leading-relaxed min-h-[80px]"
      >
        {loading ? (
          <div className="flex items-center gap-2.5 py-4 text-slate-500 dark:text-slate-400">
            <Spinner size="sm" />
            <span className="text-xs font-medium animate-pulse">
              {actionType === "explain" ? "AI is reading and explaining..." : "AI is simplifying text..."}
            </span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-red-600 dark:border-red-900/60 dark:bg-red-950/30 text-xs space-y-1.5">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={fetchAiResponse}
              className="text-[11px] font-bold underline hover:opacity-80"
            >
              Try Again
            </button>
          </div>
        ) : (
          <StreamMarkdown
            text={displayedContent.replace(/===SPLIT_LANG_EXPLANATION===/g, "\n\n---\n\n")}
            isTyping={isTyping}
          />
        )}
      </div>

      {/* 2. Bottom Footer with Action Icons (Added after content) */}
      <div className={`flex items-center justify-between gap-1 px-3.5 py-2 border-t ${footerBorder}`}>
        {/* Left: Tiny Badge */}
        <div className="flex items-center gap-1.5 opacity-80">
          <div
            className={`flex h-4 w-4 items-center justify-center rounded-md text-[10px] ${
              actionType === "explain"
                ? "bg-amber-500/20 text-amber-500"
                : "bg-indigo-500/20 text-indigo-500"
            }`}
          >
            <SparklesIcon size={10} />
          </div>
          <span className="text-[10px] font-bold">
            {actionType === "explain" ? "Explained" : "Simplified"} • P.{page}
          </span>
        </div>

        {/* Right: Function Icons Only */}
        <div className="flex items-center gap-0.5">
          {/* Skip typing animation */}
          {isTyping && (
            <button
              type="button"
              onClick={skipTyping}
              className="mr-1 rounded-md bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-bold hover:bg-black/10 transition"
              title="Show full text"
            >
              Skip
            </button>
          )}

          {/* Copy Icon */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading || !fullContent}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-90 disabled:opacity-30 ${iconButtonHover}`}
            title="Copy"
          >
            {copied ? <CheckIcon size={14} className="text-emerald-500" /> : <CopyIcon size={14} />}
          </button>

          {/* Listen (TTS) Icon */}
          {onPlayTTS && (
            <button
              type="button"
              onClick={handleTTS}
              disabled={loading || !fullContent}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-90 disabled:opacity-30 ${iconButtonHover}`}
              title="Listen"
            >
              <VolumeIcon size={14} />
            </button>
          )}

          {/* Save Note Icon */}
          {onSaveAsNote && (
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={loading || !fullContent}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-90 disabled:opacity-30 ${iconButtonHover}`}
              title="Save as Margin Note"
            >
              <TagIcon size={13} />
            </button>
          )}

          {/* Regenerate Icon */}
          <button
            type="button"
            onClick={fetchAiResponse}
            disabled={loading}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-90 disabled:opacity-30 ${iconButtonHover}`}
            title="Regenerate"
          >
            <RotateCwIcon size={13} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Close Icon */}
          <button
            type="button"
            onClick={onClose}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-90 ${iconButtonHover}`}
            title="Close"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * Clean Lightweight Markdown & Stream Renderer with Blinking Cursor
 */
function StreamMarkdown({ text, isTyping }: { text: string; isTyping: boolean }) {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Horizontal Divider
        if (trimmed === "---" || trimmed === "***") {
          return <hr key={idx} className="my-2 border-black/10 dark:border-white/10" />;
        }

        // Headers
        if (trimmed.startsWith("### ")) {
          return (
            <h5
              key={idx}
              className="font-bold text-xs text-brand-600 dark:text-brand-400 mt-2 mb-0.5"
            >
              {formatInline(trimmed.replace(/^###\s*/, ""))}
            </h5>
          );
        }
        if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          return (
            <h4 key={idx} className="font-bold text-xs sm:text-sm mt-2 mb-0.5">
              {formatInline(trimmed.replace(/^#+\s*/, ""))}
            </h4>
          );
        }

        // Bullet points
        if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
              <span className="text-brand-500 font-bold shrink-0">•</span>
              <span>{formatInline(trimmed.replace(/^[-•*]\s*/, ""))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+\.)\s*(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
              <span className="text-brand-500 font-bold shrink-0">{numMatch[1]}</span>
              <span>{formatInline(numMatch[2])}</span>
            </div>
          );
        }

        // Blockquotes
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-brand-500 pl-2 my-1 italic opacity-85"
            >
              {formatInline(trimmed.replace(/^>\s*/, ""))}
            </blockquote>
          );
        }

        // Standard Paragraph
        return (
          <p key={idx} className="leading-relaxed">
            {formatInline(line)}
          </p>
        );
      })}

      {/* Blinking typing cursor */}
      {isTyping && (
        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-brand-500 animate-pulse rounded-xs align-middle" />
      )}
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[Page\s*[^\]]+\])/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="rounded px-1 py-0.2 font-mono text-[11px] bg-black/5 dark:bg-white/10"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("[Page") && part.endsWith("]")) {
      return (
        <span
          key={idx}
          className="inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-bold bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 mx-0.5"
        >
          📖 {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}
