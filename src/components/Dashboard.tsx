"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboardService";
import { Button, buttonClass, Spinner } from "./ui";
import {
  BookmarkIcon,
  BookOpenIcon,
  ChevronRightIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "./ui/icons";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Goal Form State
  const [goalType, setGoalType] = useState("daily_pages");
  const [goalTarget, setGoalTarget] = useState(25);
  const [submittingGoal, setSubmittingGoal] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingGoal(true);
    try {
      await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: goalType,
          target: Number(goalTarget),
          period: goalType.startsWith("daily") ? "daily" : goalType.startsWith("weekly") ? "weekly" : "monthly",
        }),
      });
      setShowGoalModal(false);
      fetch("/api/dashboard")
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) setData(d);
        });
    } finally {
      setSubmittingGoal(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const hasActivity = data && (data.statistics.booksCompleted > 0 || data.statistics.pagesRead > 0 || data.continueReading.length > 0);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            My Learning Workspace
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Track reading habits, goals, streaks, and AI learning progress.
          </p>
        </div>

        <Button size="sm" onClick={() => setShowGoalModal(true)}>
          <PlusIcon size={16} />
          Set Goal
        </Button>
      </div>

      {/* Onboarding Guide for New Users */}
      {!hasActivity && (
        <div className="rounded-3xl border border-brand-200/80 bg-gradient-to-br from-brand-50 via-white to-brand-100/50 p-6 dark:border-brand-900/60 dark:from-slate-900 dark:to-brand-950/40">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Welcome to your learning space 👋
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Start reading any book in your library and eBookMine will automatically track your progress, notes, streaks, and learning statistics.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white p-3.5 shadow-sm dark:bg-slate-800">
              <span className="text-base">📖</span>
              <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">1. Read</div>
              <div className="text-[10px] text-slate-500">Read in browser with PDF.js</div>
            </div>
            <div className="rounded-2xl bg-white p-3.5 shadow-sm dark:bg-slate-800">
              <span className="text-base">💡</span>
              <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">2. Understand</div>
              <div className="text-[10px] text-slate-500">Ask AI Tutor & take notes</div>
            </div>
            <div className="rounded-2xl bg-white p-3.5 shadow-sm dark:bg-slate-800">
              <span className="text-base">📝</span>
              <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">3. Practice</div>
              <div className="text-[10px] text-slate-500">Take chapter quizzes</div>
            </div>
            <div className="rounded-2xl bg-white p-3.5 shadow-sm dark:bg-slate-800">
              <span className="text-base">🧠</span>
              <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">4. Remember</div>
              <div className="text-[10px] text-slate-500">Review flashcards</div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Books Completed"
          value={data?.statistics.booksCompleted ?? 0}
          icon="📚"
        />
        <StatCard
          label="Pages Read"
          value={data?.statistics.pagesRead ?? 0}
          icon="📄"
        />
        <StatCard
          label="Reading Streak"
          value={`${data?.statistics.currentStreak ?? 0} days`}
          icon="🔥"
        />
        <StatCard
          label="Quiz Score"
          value={`${data?.statistics.avgQuizScore ?? 100}%`}
          icon="⚡"
        />
      </div>

      {/* Continue Reading Section */}
      {data?.continueReading && data.continueReading.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Continue Reading
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {data.continueReading.map((item) => (
              <div
                key={item.book.id}
                className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                {item.book.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.book.cover}
                    alt={item.book.title}
                    className="h-16 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-brand-100 font-bold text-xs text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    PDF
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                    {item.book.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Page {item.progress.currentPage} / {item.progress.totalPages} ({item.progress.progressPercentage}%)
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: `${item.progress.progressPercentage}%` }}
                    />
                  </div>
                </div>
                <Link
                  href={`/read/${item.book.id}`}
                  className={buttonClass({ variant: "primary", size: "sm" })}
                >
                  Read
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal Creation Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Set Reading Goal</h3>
              <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Goal Type</label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="daily_pages">Daily Pages</option>
                  <option value="daily_minutes">Daily Minutes</option>
                  <option value="weekly_pages">Weekly Pages</option>
                  <option value="monthly_books">Monthly Books</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Target Amount</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <Button type="submit" className="w-full py-2 text-xs" disabled={submittingGoal}>
                {submittingGoal ? <Spinner size="sm" /> : "Save Goal"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}
