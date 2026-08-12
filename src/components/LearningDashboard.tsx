"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Spinner } from "./ui";
import { SparklesIcon, CheckIcon, RefreshIcon } from "./ui/icons";

export interface LearningDashboardProps {
  bookId?: string;
  onNavigatePage?: (page: number) => void;
}

export default function LearningDashboard({
  bookId,
  onNavigatePage,
}: LearningDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Active Interactive Mode: "overview" | "quiz" | "flashcards"
  const [mode, setMode] = useState<"overview" | "quiz" | "flashcards">("overview");

  // Active Quiz State
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  // Active Flashcards State
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    const url = `/api/learning/dashboard` + (bookId ? `?bookId=${bookId}` : "");
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (Array.isArray(d.dueFlashcards)) setFlashcards(d.dueFlashcards);
      })
      .finally(() => setLoading(false));
  }, [bookId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
  }, [loadDashboard]);

  const handleGenerateQuiz = async () => {
    if (!bookId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/learning/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", bookId }),
      });
      const d = await res.json();
      if (d.quiz) {
        setActiveQuiz(d.quiz);
        setQuizAnswers({});
        setQuizResult(null);
        setMode("quiz");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    setQuizSubmitting(true);
    try {
      const answersArray = Object.entries(quizAnswers).map(([questionId, userAnswer]) => ({
        questionId,
        userAnswer,
      }));

      const res = await fetch("/api/learning/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          quizId: activeQuiz.id,
          answers: answersArray,
        }),
      });

      const d = await res.json();
      if (d.attempt) {
        setQuizResult(d.attempt);
        loadDashboard();
      }
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!bookId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/learning/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", bookId }),
      });
      const d = await res.json();
      if (Array.isArray(d.flashcards)) {
        setFlashcards(d.flashcards);
        setCardIdx(0);
        setShowAnswer(false);
        setMode("flashcards");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReviewCard = async (rating: 1 | 2 | 3 | 4) => {
    const currentCard = flashcards[cardIdx];
    if (!currentCard) return;

    await fetch("/api/learning/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review",
        cardId: currentCard.id,
        rating,
      }),
    });

    setShowAnswer(false);
    if (cardIdx + 1 < flashcards.length) {
      setCardIdx(cardIdx + 1);
    } else {
      setMode("overview");
      loadDashboard();
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const currentCard = flashcards[cardIdx];

  return (
    <div className="space-y-4 text-xs text-slate-800 dark:text-slate-200">
      {/* Overview Cards */}
      {mode === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Quiz Avg Score
              </span>
              <p className="mt-1 text-2xl font-black text-brand-600 dark:text-brand-400">
                {data?.avgQuizScore || 0}%
              </p>
              <p className="text-[10px] text-slate-400">{data?.totalAttempts || 0} attempts</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cards Due
              </span>
              <p className="mt-1 text-2xl font-black text-amber-500">
                {data?.dueCount || 0}
              </p>
              <p className="text-[10px] text-slate-400">{data?.totalReviewed || 0} reviewed</p>
            </div>
          </div>

          {/* Quick Actions */}
          {bookId && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleGenerateQuiz} className="flex-1">
                <SparklesIcon size={13} />
                Generate Quiz
              </Button>
              <Button size="sm" variant="secondary" onClick={handleGenerateFlashcards} className="flex-1">
                <RefreshIcon size={13} />
                Study Cards ({data?.dueCount || 0})
              </Button>
            </div>
          )}

          {/* Progress Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Learning Loop Progress
            </span>
            <div>
              <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span>Understood</span>
                <span>85%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full w-[85%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span>Memory Retention (SM-2)</span>
                <span>92%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[92%]" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Interactive Quiz Mode */}
      {mode === "quiz" && activeQuiz && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">{activeQuiz.title}</h4>
            <button onClick={() => setMode("overview")} className="text-[11px] text-slate-400 hover:text-slate-600">
              Exit
            </button>
          </div>

          {quizResult ? (
            <div className="space-y-3 text-center py-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400 font-black text-lg">
                {quizResult.score}%
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-100">
                Score: {quizResult.score}% ({quizResult.answers?.filter((a: any) => a.isCorrect).length} / {quizResult.total})
              </p>
              <Button size="sm" onClick={() => setMode("overview")}>
                Return to Dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeQuiz.questions.map((q: any, idx: number) => (
                <div key={q.id} className="space-y-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {idx + 1}. {q.question}
                  </p>
                  {q.options ? (
                    <div className="space-y-1">
                      {JSON.parse(q.options).map((opt: string) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={quizAnswers[q.id] === opt}
                            onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={quizAnswers[q.id] || ""}
                      onChange={(e) => setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                      placeholder="Type your summary..."
                      rows={2}
                      className="w-full rounded border border-slate-200 p-1.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={handleSubmitQuiz} disabled={quizSubmitting}>
                  {quizSubmitting ? <Spinner size="sm" /> : "Submit Quiz"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Spaced Repetition Flashcard Mode */}
      {mode === "flashcards" && currentCard && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Card {cardIdx + 1} of {flashcards.length}</span>
            {currentCard.page && (
              <button
                onClick={() => onNavigatePage?.(currentCard.page)}
                className="font-semibold text-brand-600 dark:text-brand-400"
              >
                Page {currentCard.page}
              </button>
            )}
          </div>

          <div
            onClick={() => setShowAnswer((v) => !v)}
            className="min-h-[120px] cursor-pointer flex flex-col items-center justify-center rounded-xl bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {currentCard.question}
            </p>
            {showAnswer ? (
              <div className="mt-3 border-t border-slate-200/80 pt-3 text-xs text-brand-700 dark:text-brand-300 font-medium">
                {currentCard.answer}
              </div>
            ) : (
              <span className="mt-3 text-[10px] text-slate-400 italic">Click card to reveal answer</span>
            )}
          </div>

          {showAnswer ? (
            <div className="grid grid-cols-4 gap-1.5 pt-2">
              <button
                onClick={() => handleReviewCard(1)}
                className="rounded-lg bg-red-100 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300"
              >
                Again (1d)
              </button>
              <button
                onClick={() => handleReviewCard(2)}
                className="rounded-lg bg-amber-100 py-1.5 text-[10px] font-bold text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
              >
                Hard (2d)
              </button>
              <button
                onClick={() => handleReviewCard(3)}
                className="rounded-lg bg-blue-100 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300"
              >
                Good (6d)
              </button>
              <button
                onClick={() => handleReviewCard(4)}
                className="rounded-lg bg-emerald-100 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
              >
                Easy (10d)
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowAnswer(true)}>
                Show Answer
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
