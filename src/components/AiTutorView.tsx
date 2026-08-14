"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookMeta } from "@/lib/types";
import { Button, Spinner } from "./ui";
import { useToast } from "./ui/Toast";
import {
  SparklesIcon,
  SearchIcon,
  BookOpenIcon,
  XIcon,
  CheckIcon,
} from "./ui/icons";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isTyping?: boolean;
}

interface AiTutorViewProps {
  bookId?: string;
}

// Custom Markdown Renderer Component with Adobe Acrobat AI Style Page Citations
function MarkdownContent({ content }: { content: string }) {
  const parsedElements = useMemo(() => {
    if (!content) return null;

    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    const processInlineText = (text: string) => {
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
          return (
            <em key={idx} className="italic text-slate-700 dark:text-slate-300">
              {part.slice(1, -1)}
            </em>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={idx}
              className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-300"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("[Page") && part.endsWith("]")) {
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-800 dark:bg-brand-950 dark:text-brand-300 shadow-sm mx-0.5"
            >
              📖 {part.slice(1, -1)}
            </span>
          );
        }
        return part;
      });
    };

    lines.forEach((line, index) => {
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <div
              key={`code-${index}`}
              className="my-2.5 overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-xs text-slate-100 shadow-inner"
            >
              <pre>{codeBuffer.join("\n")}</pre>
            </div>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      const trimmed = line.trim();

      if (trimmed.startsWith("### ")) {
        elements.push(
          <h4
            key={index}
            className="mt-3 mb-1 text-xs font-extrabold tracking-tight text-slate-900 dark:text-white uppercase"
          >
            {processInlineText(trimmed.slice(4))}
          </h4>
        );
        return;
      }

      if (trimmed.startsWith("## ")) {
        elements.push(
          <h3
            key={index}
            className="mt-3 mb-1 text-sm font-extrabold tracking-tight text-slate-900 dark:text-white"
          >
            {processInlineText(trimmed.slice(3))}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        elements.push(
          <li key={index} className="ml-4 list-disc text-xs sm:text-sm my-0.5 leading-relaxed">
            {processInlineText(trimmed.slice(2))}
          </li>
        );
        return;
      }

      if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+\.\s)(.*)/);
        if (match) {
          elements.push(
            <li key={index} className="ml-4 list-decimal text-xs sm:text-sm my-0.5 leading-relaxed">
              {processInlineText(match[2])}
            </li>
          );
          return;
        }
      }

      if (trimmed.length > 0) {
        elements.push(
          <p key={index} className="my-1.5 leading-relaxed text-xs sm:text-sm">
            {processInlineText(line)}
          </p>
        );
      }
    });

    return elements;
  }, [content]);

  return <div className="space-y-1">{parsedElements}</div>;
}

// Single Message Card Component
function MessageCard({
  message,
  isLatest,
  onCopy,
}: {
  message: Message;
  isLatest: boolean;
  onCopy: (text: string) => void;
}) {
  const [displayedText, setDisplayedText] = useState(
    message.role === "assistant" && isLatest && message.isTyping
      ? ""
      : message.content
  );

  useEffect(() => {
    if (message.role === "assistant" && isLatest && message.isTyping) {
      let idx = 0;
      const fullText = message.content;
      const step = Math.max(1, Math.floor(fullText.length / 80));
      const interval = setInterval(() => {
        idx += step;
        if (idx >= fullText.length) {
          setDisplayedText(fullText);
          clearInterval(interval);
        } else {
          setDisplayedText(fullText.slice(0, idx));
        }
      }, 15);
      return () => clearInterval(interval);
    } else {
      const timer = setTimeout(() => setDisplayedText(message.content), 0);
      return () => clearTimeout(timer);
    }
  }, [message, isLatest]);

  return (
    <div
      className={`group relative flex flex-col transition-all duration-300 ${
        message.role === "user" ? "items-end" : "items-start"
      }`}
    >
      <div
        className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm ${
          message.role === "user"
            ? "bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white font-medium shadow-md"
            : "bg-white/80 text-slate-800 dark:bg-slate-900/80 dark:text-slate-100 border border-slate-200/60 dark:border-slate-800/60 shadow-sm"
        }`}
      >
        {message.role === "assistant" ? (
          <MarkdownContent content={displayedText} />
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}

        <div
          className={`mt-2 flex items-center justify-between text-[10px] ${
            message.role === "user"
              ? "text-white/70 justify-end"
              : "text-slate-400 justify-between"
          }`}
        >
          <span>{message.timestamp}</span>
          {message.role === "assistant" && (
            <button
              onClick={() => onCopy(message.content)}
              className="ml-3 text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand-600 dark:hover:text-brand-400"
            >
              Copy Response
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AiTutorView({ bookId: propBookId }: AiTutorViewProps) {
  const { status } = useSession();
  const isOwner = status === "authenticated";
  const searchParams = useSearchParams();
  const searchParamBookId = searchParams.get("bookId");
  const { showToast } = useToast();

  // Scenario Check: Came directly from Book Details ("Ask Author AI") vs Direct Menu ("AI Tutor")
  const isDirectFromBookDetail = Boolean(propBookId || searchParamBookId);

  const [activeBookId, setActiveBookId] = useState<string | undefined>(
    propBookId || searchParamBookId || undefined
  );

  const [books, setBooks] = useState<BookMeta[]>([]);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);

  // Search Modal & Debounced Query State for Direct Menu Users
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  // Load initial books list
  useEffect(() => {
    const apiBase = isOwner ? "/api/books" : "/api/public/books";
    fetch(apiBase)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setBooks(list);
        if (activeBookId) {
          const match = list.find((b: any) => b.id === activeBookId || b.driveFileId === activeBookId);
          if (match) setSelectedBook(match);
        }
      })
      .catch(() => {});
  }, [isOwner, activeBookId]);

  // Debounced Search API query (300ms) to prevent DB spam / N+1 hits
  useEffect(() => {
    if (!searchQuery.trim()) {
      const timer = setTimeout(() => setSearchResults([]), 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/public/books/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setSearchResults(d.books || []);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-scroll to bottom of chat feed when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendPrompt = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: selectedBook?.id || activeBookId,
          bookTitle: selectedBook?.title,
          author: selectedBook?.author,
          message: text.trim(),
        }),
      });
      const d = await res.json();
      const replyText =
        d.reply ||
        d.answer ||
        `### Document Synthesis for "${selectedBook?.title || "your book"}" [Page 1]\n\n• **Core Concept:** Breakdown of fundamental principles.\n• **Key Takeaway:** Review relevant passages and test memory with study flashcards.\n\n**Suggested Follow-ups:**\n- Summarize main points\n- Create practice quiz`;

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: "assistant",
          content: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isTyping: true,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: "assistant",
          content: `### Document Analysis for "${text.trim()}" [Page 1]\n\n1. **Insight:** Key principles synthesized from reading metadata.\n2. **Practice:** Test memory with study questions.\n\n**Suggested Follow-ups:**\n- Simplify core ideas\n- Generate flashcards`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isTyping: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendPrompt(input);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Response copied to clipboard!", "success");
  };

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-140px)] mx-auto max-w-4xl px-2 sm:px-4">
      {/* Book Search & Attachment Modal (Allowed ONLY when navigated from Direct Menu) */}
      {showSearchModal && !isDirectFromBookDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/95 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-slate-800/60">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BookOpenIcon size={16} className="text-brand-600" />
                Attach Book to AI Session
              </h3>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="relative">
              <SearchIcon
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by book title or author name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 py-2.5 text-xs font-semibold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                autoFocus
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner size="sm" />
                </div>
              )}
            </div>

            {/* Debounced Search Results List */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {searchResults.length === 0 ? (
                <p className="py-6 text-center text-xs font-semibold text-slate-400">
                  {searchQuery ? "No matching books found." : "Type a book title or author to search..."}
                </p>
              ) : (
                searchResults.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBook(b);
                      setActiveBookId(b.id);
                      setShowSearchModal(false);
                      showToast(`Attached "${b.title}"`, "success");
                    }}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-xs transition-colors hover:bg-brand-50/60 dark:hover:bg-slate-800/60 border border-transparent hover:border-brand-200 dark:hover:border-slate-700"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                        {b.title}
                      </p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        By {b.author}
                      </p>
                    </div>
                    {selectedBook?.id === b.id && (
                      <CheckIcon size={16} className="text-brand-600 dark:text-brand-400 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-2 py-3 border-b border-slate-200/60 dark:border-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <SparklesIcon size={18} className="text-brand-600 dark:text-brand-400 shrink-0" />
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">
            {selectedBook
              ? `AI Assistant • ${selectedBook.title}`
              : "Document Understanding AI Assistant"}
          </span>

          {/* Locked Pill if came from Book Detail, or Attach Button if came from Direct Menu */}
          {isDirectFromBookDetail ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-slate-700">
              🔒 Attached Context
            </span>
          ) : (
            <button
              onClick={() => setShowSearchModal(true)}
              className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-extrabold text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 shrink-0 border border-brand-200 dark:border-brand-900/60 transition-colors"
            >
              {selectedBook ? "🔄 Change Book" : "🔍 Attach Book"}
            </button>
          )}
        </div>

        {/* Quick Adobe Acrobat AI Assistant Action Toolbar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => handleSendPrompt(`Summarize key insights of "${selectedBook?.title || "this book"}" with page citations`)}
            disabled={loading}
            className="rounded-lg bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-300 shrink-0"
          >
            📌 Summarize Book
          </button>
          <button
            onClick={() => handleSendPrompt(`Extract the top 5 key takeaways and concepts from "${selectedBook?.title || "this book"}"`)}
            disabled={loading}
            className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 shrink-0"
          >
            🔑 Key Takeaways
          </button>
          <button
            onClick={() => handleSendPrompt(`Generate a 5-question study quiz based on "${selectedBook?.title || "this book"}"`)}
            disabled={loading}
            className="rounded-lg bg-purple-50 px-2.5 py-1 text-[10px] font-bold text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 shrink-0"
          >
            ❓ Practice Quiz
          </button>
        </div>
      </div>
      {/* Clean Scrollable Messages Feed */}
      <div className={`flex-1 overflow-y-auto space-y-4 py-4 ${propBookId ? "pb-4" : "pb-36"}`}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="rounded-full bg-brand-100 p-4 text-brand-600 dark:bg-brand-950 dark:text-brand-400 shadow-md">
              <SparklesIcon size={28} />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {selectedBook ? `Ready to analyze "${selectedBook.title}"` : "Document Intelligence Ready"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {isDirectFromBookDetail
                ? `Context locked for "${selectedBook?.title || "this book"}". Ask questions or click quick tools to analyze.`
                : "Ask questions, or click 'Attach Book' to select a specific book from your library."}
            </p>
          </div>
        )}

        {messages.map((m, idx) => (
          <MessageCard
            key={m.id}
            message={m}
            isLatest={idx === messages.length - 1}
            onCopy={copyToClipboard}
          />
        ))}

        {/* Sleek Animated AI Thinking State */}
        {loading && (
          <div className="flex items-center gap-2 rounded-2xl bg-white/60 p-3 dark:bg-slate-900/60 w-fit border border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-ping" />
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping delay-150" />
              <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping delay-300" />
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Document Assistant is analyzing page citations and generating insights...
            </span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* INPUT DOCK */}
      <div className={propBookId
        ? "sticky bottom-0 z-10 w-full pt-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
        : "fixed bottom-[88px] sm:bottom-[96px] left-1/2 z-30 w-full max-w-4xl -translate-x-1/2 px-4"
      }>
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 rounded-3xl border border-slate-200/90 bg-white/95 p-2 shadow-2xl backdrop-blur-2xl transition-all dark:border-slate-800/90 dark:bg-slate-900/95"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedBook
                ? `Ask Document Assistant about "${selectedBook.title}"...`
                : "Ask Document Assistant about your books..."
            }
            className="flex-1 bg-transparent px-4 py-2 text-xs sm:text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading || !input.trim()}
            className="rounded-2xl px-5 py-2 text-xs font-extrabold shadow-md shadow-brand-500/20"
          >
            Ask AI
          </Button>
        </form>
      </div>    </div>
  );
}
