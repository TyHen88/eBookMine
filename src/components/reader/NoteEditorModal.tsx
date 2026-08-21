"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FileTextIcon,
  XIcon,
  CheckIcon,
  TrashIcon,
  TagIcon,
  SparklesIcon,
} from "@/components/ui/icons";

interface NoteEditorModalProps {
  isOpen: boolean;
  page: number;
  selectedText?: string;
  initialContent?: string;
  editingNoteId?: string;
  theme?: "light" | "dark" | "sepia";
  onClose: () => void;
  onSave: (content: string, page: number, noteId?: string) => void;
  onDelete?: (noteId: string) => void;
}

const QUICK_TAGS = [
  { label: "💡 Key Insight", value: "[Insight] " },
  { label: "📌 Important", value: "[Important] " },
  { label: "❓ Question", value: "[Question] " },
  { label: "📝 Summary", value: "[Summary] " },
  { label: "⚡ Action", value: "[Action] " },
];

export default function NoteEditorModal({
  isOpen,
  page,
  selectedText,
  initialContent = "",
  editingNoteId,
  theme = "light",
  onClose,
  onSave,
  onDelete,
}: NoteEditorModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = useCallback(() => {
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    onSave(content.trim(), page, editingNoteId);
    onClose();
  }, [content, isSubmitting, onSave, page, editingNoteId, onClose]);

  useEffect(() => {
    if (isOpen) {
      // Auto-focus textarea and populate initial content when modal opens
      const timer = setTimeout(() => {
        setContent(initialContent);
        setIsSubmitting(false);
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            textareaRef.current.value.length,
            textareaRef.current.value.length
          );
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialContent]);

  // Handle ESC and Cmd+Enter shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleSave, onClose]);

  if (!isOpen) return null;

  const handleTagClick = (tagValue: string) => {
    if (!content.startsWith(tagValue)) {
      // Remove any existing bracket tag if present or just prepend
      const cleaned = content.replace(/^\[.*?\]\s*/, "");
      setContent(`${tagValue}${cleaned}`);
    }
    textareaRef.current?.focus();
  };

  const isDark = theme === "dark";
  const isSepia = theme === "sepia";

  const modalBg = isDark
    ? "bg-slate-900 border-slate-800 text-white shadow-2xl shadow-black/80"
    : isSepia
    ? "bg-[#fbf7ee] border-[#dfd6c0] text-[#3e2e1e] shadow-2xl shadow-amber-950/20"
    : "bg-white border-slate-200 text-slate-900 shadow-2xl shadow-slate-900/20";

  const quoteBg = isDark
    ? "bg-slate-800/80 border-l-brand-400 text-slate-300"
    : isSepia
    ? "bg-[#f2ebd9] border-l-[#a1783f] text-[#55402b]"
    : "bg-slate-50 border-l-brand-500 text-slate-600";

  const textareaBg = isDark
    ? "bg-slate-950/80 border-slate-800 text-white placeholder-slate-500 focus:border-brand-500"
    : isSepia
    ? "bg-[#f7f0e0] border-[#d8cdb4] text-[#3e2e1e] placeholder-[#8a7762] focus:border-[#a1783f]"
    : "bg-slate-50/90 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog (Responsive: Bottom sheet on mobile, centered floating card on tablet/desktop) */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border p-5 sm:p-6 shadow-2xl backdrop-blur-xl animate-slideUp sm:animate-scaleUp max-h-[90vh] overflow-hidden ${modalBg}`}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="mx-auto -mt-2 mb-3 h-1.5 w-12 rounded-full bg-slate-300/80 dark:bg-slate-700 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 ring-1 ring-brand-500/20">
              <FileTextIcon size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {editingNoteId ? "Edit Margin Note" : "Add Margin Note"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Attached to <span className="font-semibold text-brand-600 dark:text-brand-400">Page {page}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white transition"
            title="Close (Esc)"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Selected Quote Preview if attached to text */}
        {selectedText && (
          <div className={`mt-3.5 rounded-xl border-l-4 p-3 text-xs leading-relaxed ${quoteBg}`}>
            <div className="flex items-center gap-1 font-bold text-[11px] mb-1 opacity-75">
              <TagIcon size={11} />
              <span>Selected Reference</span>
            </div>
            <p className="line-clamp-3 italic">
              &ldquo;{selectedText}&rdquo;
            </p>
          </div>
        )}

        {/* Quick Tag Pills */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
            <SparklesIcon size={12} />
            <span>Tag:</span>
          </span>
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag.label}
              type="button"
              onClick={() => handleTagClick(tag.value)}
              className="rounded-lg bg-black/5 px-2 py-1 text-[11px] font-medium hover:bg-brand-500/15 hover:text-brand-600 dark:bg-white/10 dark:hover:bg-brand-400/20 dark:hover:text-brand-300 active:scale-95 transition"
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Note Textarea Area */}
        <div className="mt-3 relative flex-1">
          <textarea
            ref={textareaRef}
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your insights, thoughts, summary, or questions here..."
            className={`w-full rounded-2xl border p-3.5 text-sm outline-none transition focus:ring-2 focus:ring-brand-500/20 resize-none ${textareaBg}`}
          />
          <div className="flex justify-between items-center px-1 text-[10px] text-slate-400">
            <span>Press <kbd className="font-mono bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">⌘ + Enter</kbd> to save</span>
            <span>{content.length} characters</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
          <div>
            {editingNoteId && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this note?")) {
                    onDelete(editingNoteId);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-95 transition"
              >
                <TrashIcon size={14} />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10 active:scale-95 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!content.trim() || isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-brand-500/25 hover:bg-brand-500 disabled:opacity-40 active:scale-95 transition"
            >
              <CheckIcon size={14} />
              <span>{editingNoteId ? "Update Note" : "Save Note"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
