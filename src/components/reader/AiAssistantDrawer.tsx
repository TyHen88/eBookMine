"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { DocumentTab, ChatMessage } from "./context/ReaderTabContext";
import {
  SparklesIcon,
  XIcon,
  RefreshIcon,
} from "@/components/ui/icons";
import { Spinner } from "@/components/ui";

interface AiAssistantDrawerProps {
  tab: DocumentTab;
  currentPage: number;
  isOpen: boolean;
  initialPrompt?: string;
  onClose: () => void;
  onJumpToPage: (page: number) => void;
  onUpdateChatHistory: (messages: ChatMessage[]) => void;
  onClearInitialPrompt?: () => void;
}

// Markdown parser with interactive [Page X] citation links
function AiMarkdownView({
  content,
  onJumpToPage,
}: {
  content: string;
  onJumpToPage: (p: number) => void;
}) {
  const elements = useMemo(() => {
    if (!content) return null;
    const lines = content.split("\n");

    return lines.map((line, lineIdx) => {
      if (line.startsWith("### ")) {
        return (
          <h4 key={lineIdx} className="text-xs font-bold text-slate-900 dark:text-white mt-2 mb-1">
            {line.slice(4)}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={lineIdx} className="text-sm font-extrabold text-slate-900 dark:text-white mt-2.5 mb-1">
            {line.slice(3)}
          </h3>
        );
      }

      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[Page\s*\d+\])/g);
      const formatted = parts.map((part, partIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={partIdx} className="font-bold text-slate-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={partIdx} className="italic">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={partIdx}
              className="rounded bg-slate-200/80 px-1 py-0.5 font-mono text-[11px] font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-300"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("[Page") && part.endsWith("]")) {
          const match = part.match(/\d+/);
          const pageNum = match ? parseInt(match[0], 10) : null;
          return (
            <button
              key={partIdx}
              type="button"
              onClick={() => pageNum && onJumpToPage(pageNum)}
              className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 hover:bg-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900 transition mx-0.5 shadow-sm active:scale-95"
              title={`Jump to Page ${pageNum}`}
            >
              <span>📖</span>
              <span>Page {pageNum}</span>
            </button>
          );
        }
        return part;
      });

      return (
        <p key={lineIdx} className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {formatted}
        </p>
      );
    });
  }, [content, onJumpToPage]);

  return <div className="space-y-1.5">{elements}</div>;
}

export default function AiAssistantDrawer({
  tab,
  currentPage,
  isOpen,
  initialPrompt,
  onClose,
  onJumpToPage,
  onUpdateChatHistory,
  onClearInitialPrompt,
}: AiAssistantDrawerProps) {
  const [localPending, setLocalPending] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => {
    return [...(tab.chatHistory || []), ...localPending];
  }, [tab.chatHistory, localPending]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (promptText: string) => {
      if (!promptText.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: promptText.trim(),
        page: currentPage,
        timestamp: new Date().toISOString(),
      };

      setLocalPending([userMsg]);
      setInputPrompt("");
      setLoading(true);

      try {
        const activeHistory = [...(tab.chatHistory || []), userMsg];

        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: tab.id,
            bookTitle: tab.title,
            author: tab.author,
            message: userMsg.content,
            prompt: userMsg.content,
            page: currentPage,
            chatHistory: activeHistory.slice(-8).map((m) => ({
              role: m.role,
              content: m.content,
              page: m.page,
            })),
          }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          const errorContent = data.error || "Sorry, I encountered an issue connecting to the AI companion.";
          const errorMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: "assistant",
            content: errorContent,
            page: currentPage,
            timestamp: new Date().toISOString(),
          };
          setLocalPending([]);
          onUpdateChatHistory([...activeHistory, errorMsg]);
          return;
        }

        const replyContent =
          data.reply ||
          data.result ||
          (typeof data.message === "string" ? data.message : data.message?.content) ||
          "";

        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content: replyContent,
          page: currentPage,
          citations: data.citations || [],
          timestamp: new Date().toISOString(),
        };

        const updatedAll = [...activeHistory, assistantMsg];
        setLocalPending([]);
        onUpdateChatHistory(updatedAll);
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content: err?.message || "Sorry, I encountered a network issue connecting to the AI companion.",
          page: currentPage,
          timestamp: new Date().toISOString(),
        };
        setLocalPending([]);
        onUpdateChatHistory([...(tab.chatHistory || []), userMsg, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [currentPage, loading, onUpdateChatHistory, tab.author, tab.chatHistory, tab.id, tab.title]
  );

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && isOpen) {
      const timer = setTimeout(() => {
        sendMessage(initialPrompt);
        onClearInitialPrompt?.();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, isOpen, onClearInitialPrompt, sendMessage]);

  const handleClearHistory = () => {
    setLocalPending([]);
    onUpdateChatHistory([]);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-fadeIn"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex h-full w-full sm:w-96 md:relative md:inset-auto md:z-30 md:w-80 lg:w-96 flex-col border-l border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 transition-all animate-slideLeft"
      >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 p-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-sm shadow-brand-500/25">
            <SparklesIcon size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>AI Assistant</span>
              <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                P.{currentPage}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 truncate max-w-[190px]">
              {tab.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              title="Clear conversation"
            >
              <RefreshIcon size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            aria-label="Close AI Assistant"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="border-b border-slate-100 bg-slate-50/60 p-2.5 space-y-1.5 dark:border-slate-800/80 dark:bg-slate-900/50">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Page {currentPage} Quick Actions
        </span>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => sendMessage(`Summarize the core takeaways of Page ${currentPage}`)}
            className="rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm border border-slate-200 hover:border-brand-500 hover:text-brand-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-400 transition"
          >
            ⚡ Summarize Page
          </button>
          <button
            onClick={() => sendMessage(`Explain key technical terms on Page ${currentPage}`)}
            className="rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm border border-slate-200 hover:border-brand-500 hover:text-brand-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-400 transition"
          >
            💡 Key Terms
          </button>
          <button
            onClick={() => sendMessage(`Generate a 3-question quiz testing my understanding of Page ${currentPage}`)}
            className="rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm border border-slate-200 hover:border-brand-500 hover:text-brand-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-400 transition"
          >
            ❓ Quiz Me
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center p-6 text-center space-y-2 text-slate-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <SparklesIcon size={20} />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Ask Anything About This Book
            </p>
            <p className="text-[11px] text-slate-400 max-w-[220px]">
              The AI Tutor reads with you. Tap a quick action above or ask about any concept.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3 text-xs shadow-sm ${
                  m.role === "user"
                    ? "bg-brand-600 text-white rounded-br-none"
                    : "bg-slate-100 border border-slate-200/80 text-slate-900 rounded-bl-none dark:bg-slate-800/80 dark:border-slate-700/80 dark:text-white"
                }`}
              >
                {m.role === "assistant" ? (
                  <AiMarkdownView content={m.content} onJumpToPage={onJumpToPage} />
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
              <span className="mt-1 px-1 text-[9px] text-slate-400">
                {m.page ? `Page ${m.page}` : ""}
              </span>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2 p-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
            <Spinner size="sm" />
            <span>AI Tutor is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="border-t border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(inputPrompt);
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={`Ask about Page ${currentPage}...`}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-500/25 hover:bg-brand-700 disabled:opacity-40 transition"
          >
            <SparklesIcon size={14} />
          </button>
        </form>
      </div>
    </aside>
    </>
  );
}
