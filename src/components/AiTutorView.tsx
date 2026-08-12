"use client";

import { useState } from "react";
import { Button, Spinner } from "./ui";
import { SparklesIcon, BookOpenIcon } from "./ui/icons";

export default function AiTutorView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "Hello! I am your eBookMine AI Tutor 🎓. Select a book from your library or ask me any question about your reading, chapter concepts, or study notes!",
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const d = await res.json();
      if (d.reply || d.answer) {
        setMessages((prev) => [...prev, { role: "assistant", content: d.reply || d.answer }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Regarding "${userMessage}":\n\n1. **Core Concept:** Focus on key principles in your current chapter.\n2. **Study Tip:** Highlight important passages and review your flashcards to test memory.`,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Here is a study breakdown for "${userMessage}":\n\n• **Analysis:** Break down complex topics into smaller sections.\n• **Review:** Test your recall with multiple-choice questions.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-brand-200/80 bg-gradient-to-r from-brand-500/10 via-brand-400/5 to-transparent p-6 dark:border-brand-900/60 dark:from-brand-950/40">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/30">
            <SparklesIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              AI Tutor Companion
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ask questions, simplify complex topics, generate quizzes, and deepen your understanding.
            </p>
          </div>
        </div>
      </div>

      {/* Chat Conversation Box */}
      <div className="flex h-[520px] flex-col rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="flex-1 overflow-y-auto space-y-4 p-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white text-xs font-bold shadow-md">
                  AI
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl p-3.5 text-xs whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-brand-600 text-white font-medium"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-200"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center text-xs text-slate-400 p-2">
              <Spinner size="sm" /> AI Tutor is thinking...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI Tutor anything about your books or study goals..."
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <Button type="submit" size="sm" disabled={loading || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
