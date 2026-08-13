"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Spinner } from "./ui";
import { SparklesIcon, CheckIcon, RefreshIcon, XIcon, InfoIcon } from "./ui/icons";

export interface LearningDashboardProps {
  bookId?: string;
  page?: number;
  onNavigatePage?: (page: number) => void;
}

export default function LearningDashboard({
  bookId,
  page,
  onNavigatePage,
}: LearningDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Active Interactive Mode: "overview" | "quiz" | "flashcards"
  const [mode, setMode] = useState<"overview" | "quiz" | "flashcards">("overview");

  // Active Quiz State & Loading
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
  }, [loadDashboard]);

  const handleGenerateQuiz = async () => {
    if (!bookId) return;
    setGeneratingQuiz(true);
    try {
      const res = await fetch("/api/learning/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", bookId, page, count: 5 }),
      });
      const d = await res.json();
      if (d.quiz) {
        setActiveQuiz(d.quiz);
        setQuizAnswers({});
        setQuizResult(null);
        setMode("quiz");
      }
    } catch (err) {
      console.error("Quiz generation failed:", err);
    } finally {
      setGeneratingQuiz(false);
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
    } catch (err) {
      console.error("Quiz submission error:", err);
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!bookId) return;
    setGeneratingCards(true);
    try {
      const res = await fetch("/api/learning/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", bookId, page }),
      });
      const d = await res.json();
      if (Array.isArray(d.flashcards) && d.flashcards.length > 0) {
        setFlashcards(d.flashcards);
        setCardIdx(0);
        setShowAnswer(false);
        setMode("flashcards");
      }
    } catch (err) {
      console.error("Flashcards generation error:", err);
    } finally {
      setGeneratingCards(false);
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

  if (loading && !data && !generatingQuiz) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
        <Spinner size="lg" />
        <span className="text-xs font-semibold text-slate-500">Loading AI Study Hub...</span>
      </div>
    );
  }

  const currentCard = flashcards[cardIdx];

  return (
    <div className="space-y-4 text-xs text-slate-800 dark:text-slate-200">
      {/* 1. Quiz Generation Loading Screen */}
      {generatingQuiz && (
        <div className="space-y-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-5 text-center shadow-lg dark:border-brand-900/60 dark:bg-slate-900 animate-fade-in">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-xl shadow-brand-500/30 animate-pulse">
            <SparklesIcon size={26} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Crafting AI Quiz Questions...
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI is reading Page {page || 1} passages to create 5 customized multiple-choice questions.
            </p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-slate-800">
            <div className="h-full w-full bg-brand-500 rounded-full animate-shimmer" />
          </div>
        </div>
      )}

      {/* 2. Flashcard Generation Loading Screen */}
      {generatingCards && (
        <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 text-center shadow-lg dark:border-amber-900/60 dark:bg-slate-900 animate-fade-in">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-xl shadow-amber-500/30 animate-pulse">
            <RefreshIcon size={26} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Generating Study Cards for Page {page || 1}...
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI is building 5 spaced repetition flashcards from your active page content.
            </p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100 dark:bg-slate-800">
            <div className="h-full w-full bg-amber-500 rounded-full animate-shimmer" />
          </div>
        </div>
      )}

      {/* 3. Overview Dashboard */}
      {!generatingQuiz && !generatingCards && mode === "overview" && (
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
              <Button
                size="sm"
                onClick={handleGenerateQuiz}
                disabled={generatingQuiz || generatingCards}
                className="flex-1 shadow-md shadow-brand-500/20"
              >
                {generatingQuiz ? (
                  <>
                    <Spinner size="sm" />
                    Generating...
                  </>
                ) : (
                  <>
                    <SparklesIcon size={13} />
                    Generate Quiz
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleGenerateFlashcards}
                disabled={generatingCards || generatingQuiz}
                className="flex-1"
              >
                {generatingCards ? (
                  <>
                    <Spinner size="sm" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshIcon size={13} />
                    Study Cards ({data?.dueCount || 0})
                  </>
                )}
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
                <span>Reading Comprehension</span>
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

      {/* 3. Interactive Quiz Mode */}
      {!generatingQuiz && mode === "quiz" && activeQuiz && (
        <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800/80">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                <SparklesIcon size={14} />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs sm:text-sm">
                {activeQuiz.title}
              </h4>
            </div>
            <button
              onClick={() => setMode("overview")}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              title="Exit Quiz"
            >
              <XIcon size={14} />
            </button>
          </div>

          {/* Quiz Results Screen */}
          {quizResult ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white font-black text-xl shadow-xl shadow-brand-500/25">
                {quizResult.score}%
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {quizResult.score >= 70 ? "🎉 Outstanding Job!" : "📚 Keep Studying!"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You scored {quizResult.score}% ({quizResult.answers?.filter((a: any) => a.isCorrect).length} / {quizResult.total} questions correct).
                </p>
              </div>

              {/* Question Feedback Breakdown */}
              <div className="space-y-2 text-left pt-2">
                {activeQuiz.questions.map((q: any, idx: number) => {
                  const attemptAns = quizResult.answers?.find((a: any) => a.questionId === q.id);
                  const isCorrect = attemptAns?.isCorrect;
                  return (
                    <div
                      key={q.id}
                      className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                        isCorrect
                          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                          : "border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/30"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-900 dark:text-slate-100">
                          {idx + 1}. {q.question}
                        </span>
                        <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-md font-extrabold ${
                          isCorrect ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
                        }`}>
                          {isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      </div>

                      {q.explanation && (
                        <div className="flex items-start gap-1.5 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                          <InfoIcon size={13} className="shrink-0 mt-0.5 text-brand-500" />
                          <span><strong>AI Explanation:</strong> {q.explanation}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleGenerateQuiz} className="flex-1">
                  <RefreshIcon size={13} />
                  Try Another Quiz
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setMode("overview")} className="flex-1">
                  Back to Dashboard
                </Button>
              </div>
            </div>
          ) : (
            /* Active Quiz Form */
            <div className="space-y-4">
              {activeQuiz.questions.map((q: any, idx: number) => {
                let optionsList: string[] = [];
                try {
                  optionsList = typeof q.options === "string" ? JSON.parse(q.options) : q.options || [];
                } catch {
                  optionsList = ["Option A", "Option B", "Option C", "Option D"];
                }

                return (
                  <div
                    key={q.id}
                    className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-800/80 dark:bg-slate-800/50"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-black text-white">
                        {idx + 1}
                      </span>
                      <p className="text-xs font-bold leading-snug text-slate-900 dark:text-slate-100">
                        {q.question}
                      </p>
                    </div>

                    {optionsList.length > 0 ? (
                      <div className="space-y-1.5 pl-7">
                        {optionsList.map((opt: string, optIdx: number) => {
                          const letter = String.fromCharCode(65 + optIdx);
                          const isSelected = quizAnswers[q.id] === opt;
                          return (
                            <button
                              type="button"
                              key={opt}
                              onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                              className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left text-xs font-semibold transition-all ${
                                isSelected
                                  ? "border-brand-500 bg-white text-brand-700 shadow-sm ring-2 ring-brand-500/30 dark:bg-slate-900 dark:text-brand-300"
                                  : "border-slate-200/80 bg-white/70 text-slate-700 hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-300"
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-[10px] font-black transition-colors ${
                                  isSelected
                                    ? "bg-brand-600 text-white"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {letter}
                              </span>
                              <span className="flex-1">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <textarea
                        value={quizAnswers[q.id] || ""}
                        onChange={(e) => setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                        placeholder="Type your answer..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900"
                      />
                    )}
                  </div>
                );
              })}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={handleSubmitQuiz}
                  disabled={quizSubmitting || Object.keys(quizAnswers).length === 0}
                  className="w-full sm:w-auto"
                >
                  {quizSubmitting ? (
                    <>
                      <Spinner size="sm" />
                      Grading Quiz...
                    </>
                  ) : (
                    <>
                      <CheckIcon size={14} />
                      Submit Quiz
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Spaced Repetition Flashcards */}
      {!generatingQuiz && mode === "flashcards" && currentCard && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-fade-in">
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
            className="min-h-[120px] cursor-pointer flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
          >
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {currentCard.question}
            </p>
            {showAnswer ? (
              <div className="mt-3 border-t border-slate-200/80 pt-3 text-xs text-brand-700 dark:text-brand-300 font-semibold">
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
                className="rounded-xl bg-rose-100 py-2 text-[10px] font-bold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300"
              >
                Again (1d)
              </button>
              <button
                onClick={() => handleReviewCard(2)}
                className="rounded-xl bg-amber-100 py-2 text-[10px] font-bold text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
              >
                Hard (2d)
              </button>
              <button
                onClick={() => handleReviewCard(3)}
                className="rounded-xl bg-blue-100 py-2 text-[10px] font-bold text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300"
              >
                Good (6d)
              </button>
              <button
                onClick={() => handleReviewCard(4)}
                className="rounded-xl bg-emerald-100 py-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
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
