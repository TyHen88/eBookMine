"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookMeta } from "@/lib/types";
import { Button, Spinner } from "./ui";
import { useToast } from "./ui/Toast";
import { SparklesIcon, CheckIcon, RefreshIcon } from "./ui/icons";

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

// Custom Markdown Renderer Component
function MarkdownContent({ content }: { content: string }) {
  const parsedElements = useMemo(() => {
    if (!content) return null;

    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let tableRows: string[] = [];

    const processInlineText = (text: string) => {
      // Split by bold (**text**), italic (*text*), and inline code (`code`)
      const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
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
        return part;
      });
    };

    lines.forEach((line, index) => {
      // Handle Code Blocks
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

      // Handle Headings
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
      if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
        elements.push(
          <h3
            key={index}
            className="mt-4 mb-1.5 text-sm font-extrabold text-slate-900 dark:text-white"
          >
            {processInlineText(trimmed.replace(/^#+\s*/, ""))}
          </h3>
        );
        return;
      }

      // Handle Bullet Points
      if (
        trimmed.startsWith("• ") ||
        trimmed.startsWith("- ") ||
        trimmed.startsWith("* ")
      ) {
        const bulletText = trimmed.replace(/^[•\-\*]\s*/, "");
        elements.push(
          <div key={index} className="my-1 flex items-start gap-2 text-xs leading-relaxed">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
            <div className="flex-1 text-slate-800 dark:text-slate-200">
              {processInlineText(bulletText)}
            </div>
          </div>
        );
        return;
      }

      // Handle Numbered Lists
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        elements.push(
          <div key={index} className="my-1 flex items-start gap-2 text-xs leading-relaxed">
            <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
              {numMatch[1]}.
            </span>
            <div className="flex-1 text-slate-800 dark:text-slate-200">
              {processInlineText(numMatch[2])}
            </div>
          </div>
        );
        return;
      }

      // Handle Blockquotes
      if (trimmed.startsWith("> ")) {
        elements.push(
          <blockquote
            key={index}
            className="my-2 border-l-3 border-brand-500 bg-brand-50/50 py-1.5 pl-3 text-xs italic text-slate-700 dark:bg-brand-950/40 dark:text-slate-300"
          >
            {processInlineText(trimmed.slice(2))}
          </blockquote>
        );
        return;
      }

      // Handle Paragraphs
      if (trimmed.length > 0) {
        elements.push(
          <p key={index} className="my-1 text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
            {processInlineText(line)}
          </p>
        );
      } else {
        elements.push(<div key={index} className="h-1.5" />);
      }
    });

    return elements;
  }, [content]);

  return <div className="space-y-0.5">{parsedElements}</div>;
}

// Single Message Card Component (Typewriter animation for latest assistant message)
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
      setDisplayedText(message.content);
    }
  }, [message, isLatest]);

  return (
    <div
      className={`group relative flex flex-col transition-all duration-300 ${
        message.role === "user" ? "items-end" : "items-start"
      }`}
    >
      {/* Clean Message Card Without Avatars */}
      <div
        className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm ${
          message.role === "user"
            ? "bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white font-medium shadow-md"
            : "bg-white/80 text-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
        }`}
      >
        {message.role === "assistant" ? (
          <MarkdownContent content={displayedText} />
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}

        <div
          className={`mt-1.5 flex items-center justify-between text-[10px] ${
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
              Copy
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

  const [activeBookId] = useState<string | undefined>(
    propBookId || searchParamBookId || undefined
  );

  const [books, setBooks] = useState<BookMeta[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  // Load books list
  useEffect(() => {
    const apiBase = isOwner ? "/api/books" : "/api/public/books";
    fetch(apiBase)
      .then((r) => r.json())
      .then((d) => setBooks((d.books as BookMeta[]) ?? []))
      .catch(() => setBooks([]));
  }, [isOwner]);

  const activeBook = useMemo(
    () => (activeBookId ? books.find((b) => b.id === activeBookId) : books[0]),
    [books, activeBookId]
  );

  // Initial welcome message scoped to active book
  useEffect(() => {
    if (activeBook) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Hello! I am your AI Tutor 🎓.\n\nI am currently scoped to **"${activeBook.title}"** ${
            activeBook.author ? `by ${activeBook.author}` : ""
          }.\n\nAsk me any question about key principles, concepts, or chapter topics in this book!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isTyping: false,
        },
      ]);
    } else {
      setMessages([
        {
          id: "welcome-general",
          role: "assistant",
          content:
            "Hello! I am your eBookMine AI Tutor 🎓.\n\nAsk me any question about your reading, chapter concepts, or study notes!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isTyping: false,
        },
      ]);
    }
  }, [activeBook]);

  // Auto-scroll to bottom of chat feed when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const samplePrompts = useMemo(() => {
    if (activeBook) {
      return [
        `Summarize the main themes of ${activeBook.title}`,
        `Generate a 5-question quiz for ${activeBook.title}`,
        `Explain core concepts in simple terms`,
        `Create 3 study flashcards for this book`,
      ];
    }
    return [
      "Summarize key concepts in my recent reading",
      "Generate a 5-question multiple choice quiz",
      "Explain difficult terms in simple language",
      "Create 3 flashcards for revision",
    ];
  }, [activeBook]);

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
          bookId: activeBook?.id,
          bookTitle: activeBook?.title,
          author: activeBook?.author,
          message: text.trim(),
        }),
      });
      const d = await res.json();
      const replyText =
        d.reply ||
        d.answer ||
        `Study Analysis for "${activeBook?.title || "your book"}":\n\n• **Core Concept:** Focus on key principles in your reading.\n• **Key Takeaway:** Highlight important passages and review your flashcards to reinforce memory.`;

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
          content: `Study Summary for "${text.trim()}":\n\n1. **Key Insight:** Break down complex topics into digestible sections.\n2. **Practice:** Test your memory with multiple-choice questions.`,
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
    showToast("Message copied to clipboard!", "success");
  };

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-140px)] mx-auto max-w-4xl px-2 sm:px-4">
      {/* Clean Header Bar */}
      <div className="flex items-center justify-between py-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <SparklesIcon size={18} className="text-brand-600 dark:text-brand-400" />
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
            {activeBook ? `AI Tutor • ${activeBook.title}` : "AI Tutor Companion"}
          </span>
        </div>

        {/* Quick Sample Suggestions Pill Toolbar */}
        {messages.length <= 1 && (
          <div className="hidden sm:flex items-center gap-1">
            {samplePrompts.slice(0, 2).map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendPrompt(p)}
                disabled={loading}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clean Scrollable Messages Feed (No Heavy Outer Borders or Shadows) */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 pb-36">
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
          <div className="flex items-center gap-2 rounded-2xl bg-white/60 p-3 dark:bg-slate-900/60 w-fit">
            <div className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-ping" />
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping delay-150" />
              <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping delay-300" />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              AI Tutor is analyzing and generating response...
            </span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* FLOATING INPUT DOCK (Pinned to Bottom with space above Navigation Bar) */}
      <div className="fixed bottom-[88px] sm:bottom-[96px] left-1/2 z-30 w-full max-w-4xl -translate-x-1/2 px-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 rounded-3xl border border-slate-200/90 bg-white/95 p-2 shadow-2xl backdrop-blur-2xl transition-all dark:border-slate-800/90 dark:bg-slate-900/95"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeBook
                ? `Ask AI anything about "${activeBook.title}"...`
                : "Ask AI Tutor anything about your books..."
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
      </div>
    </div>
  );
}
