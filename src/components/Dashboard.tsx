"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DashboardData } from "@/lib/dashboardService";
import { Button, buttonClass, Spinner, BookLoader } from "./ui";
import { useToast } from "./ui/Toast";
import AuthPromptModal from "./AuthPromptModal";
import BookThumbnailImg from "./BookThumbnailImg";
import { prefetchPdf } from "@/lib/pdfCache";
import {
  BookmarkIcon,
  BookOpenIcon,
  ChevronRightIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
  GridIcon,
  CheckIcon,
  CloudIcon,
  TagIcon,
  InfoIcon,
} from "./ui/icons";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { showToast } = useToast();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Goal Form State
  const [goalType, setGoalType] = useState("daily_pages");
  const [goalTarget, setGoalTarget] = useState(25);
  const [submittingGoal, setSubmittingGoal] = useState(false);

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Reader";

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleOpenSetGoal = () => {
    if (!isAuthenticated) {
      showToast("Please sign in to customize your reading goals", "info");
      setShowAuthModal(true);
      return;
    }
    setShowGoalModal(true);
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    setSubmittingGoal(true);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: goalType,
          target: Number(goalTarget),
          period: goalType.startsWith("daily")
            ? "daily"
            : goalType.startsWith("weekly")
            ? "weekly"
            : "monthly",
        }),
      });

      if (res.ok) {
        showToast("Reading goal updated successfully! 🎯", "success");
        setShowGoalModal(false);
        fetch("/api/dashboard")
          .then((r) => r.json())
          .then((d) => {
            if (!d.error) setData(d);
          });
      } else {
        showToast("Failed to update goal. Please try again.", "error");
      }
    } catch {
      showToast("Error updating goal.", "error");
    } finally {
      setSubmittingGoal(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-72 items-center justify-center">
        <BookLoader label="Loading Workspace & Goal Metrics..." />
      </div>
    );
  }

  const activeGoal = data?.goals?.[0];
  const goalTargetVal = activeGoal?.target || 25;
  const goalCurrentVal = activeGoal?.current || Math.min(data?.statistics.pagesRead || 0, goalTargetVal);
  const goalPct = Math.min(100, Math.round((goalCurrentVal / goalTargetVal) * 100));

  // Weekly reading activity calculated from real user data
  const weeklyDays = data?.statistics.dailyDaysLabels || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activityData = data?.statistics.dailyPagesRead || [0, 0, 0, 0, 0, 0, 0];
  const maxPages = Math.max(...activityData, 10);

  return (
    <div className="space-y-3.5 sm:space-y-5 animate-fade-in pb-10">
      {/* Auth Prompt Modal */}
      {showAuthModal && <AuthPromptModal onClose={() => setShowAuthModal(false)} />}

      {/* Hero Greeting & Motivational Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-brand-200/60 bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-700 p-3.5 sm:p-5 text-white shadow-md shadow-brand-500/20 dark:border-brand-900/60">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md">
              <SparklesIcon size={12} className="text-amber-300" />
              <span>{isAuthenticated ? `Welcome back, ${userName}!` : "Welcome to eBookMine Library"}</span>
            </div>
            <h1 className="mt-1.5 text-lg sm:text-2xl font-black tracking-tight text-white">
              {isAuthenticated ? "Keep Up Your Reading Momentum" : "Read, Understand & Master Any PDF"}
            </h1>
            <p className="mt-0.5 max-w-xl text-xs text-brand-100/90 line-clamp-1 sm:line-clamp-none">
              {isAuthenticated
                ? "Track reading goals, review AI flashcards, and build daily study streaks in your personal library."
                : "Sign in to sync your library, save progress, and interact with AI RAG study tools."}
            </p>
          </div>

          {/* Banner Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/library"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-xs transition-all hover:bg-brand-50 hover:scale-105 active:scale-95"
            >
              <BookOpenIcon size={14} />
              <span>Library</span>
            </Link>

            <button
              onClick={handleOpenSetGoal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white shadow-xs backdrop-blur-md ring-1 ring-white/30 transition-all hover:bg-white/30 active:scale-95"
            >
              <PlusIcon size={14} />
              <span>Set Goal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Guest Mode Onboarding & Showcase Banner */}
      {!isAuthenticated && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300 shrink-0">
                <InfoIcon size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Unlock Full AI Study Features & Library Sync
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sign in to save highlights, personal notes, chapter quiz scores, and daily streaks.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowAuthModal(true)} className="py-1.5 text-xs">
              Sign In Now
            </Button>
          </div>
        </div>
      )}

      {/* Top Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MetricCard
          label="Completed"
          value={data?.statistics.booksCompleted ?? 0}
          unit="Books"
          icon="📚"
          color="from-blue-500 to-indigo-600"
        />
        <MetricCard
          label="Pages Read"
          value={data?.statistics.pagesRead ?? 0}
          unit="Pages"
          icon="📄"
          color="from-brand-500 to-brand-700"
        />
        <MetricCard
          label="Streak"
          value={`${data?.statistics.currentStreak ?? 0} Days`}
          unit="Active"
          icon="🔥"
          color="from-amber-500 to-orange-600"
        />
        <MetricCard
          label="Quiz Avg"
          value={`${data?.statistics.avgQuizScore ?? 100}%`}
          unit="Mastery"
          icon="⚡"
          color="from-emerald-500 to-teal-600"
        />
      </div>

      {/* Main Grid: Active Reading Goal & Weekly Activity */}
      <div className="grid grid-cols-1 gap-3.5 sm:gap-4 lg:grid-cols-3">
        {/* Active Reading Goal Card */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3.5 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              Daily Goal Progress
            </h2>
            <button
              onClick={handleOpenSetGoal}
              className="text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Configure
            </button>
          </div>

          <div className="mt-3.5 flex flex-col items-center justify-center text-center">
            {/* Visual Ring Gauge */}
            <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-brand-600 dark:text-brand-400 transition-all duration-1000 ease-out"
                  strokeDasharray={`${goalPct}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{goalPct}%</span>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Goal</span>
              </div>
            </div>

            <p className="mt-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              {goalCurrentVal} / {goalTargetVal} Pages Today
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              {goalPct >= 100
                ? "🎉 Daily goal achieved!"
                : `${goalTargetVal - goalCurrentVal} more pages to reach target.`}
            </p>
          </div>
        </div>

        {/* Weekly Activity Bar Chart */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3.5 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Weekly Reading Activity
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pages read each day over the past week
              </p>
            </div>
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              This Week
            </span>
          </div>

          <div className="mt-5 flex h-28 items-end justify-between gap-1.5 px-1">
            {weeklyDays.map((day, idx) => {
              const pages = activityData[idx];
              const barHeight = Math.max(12, Math.round((pages / maxPages) * 100));
              const isToday = idx === 6;

              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-1.5 group">
                  <span className="text-[9px] font-bold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                    {pages}p
                  </span>
                  <div className="w-full max-w-[24px] rounded-t-lg bg-slate-100 dark:bg-slate-800 overflow-hidden h-20 flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-700 ${
                        isToday
                          ? "bg-gradient-to-t from-brand-600 to-brand-400 shadow-sm shadow-brand-500/30"
                          : "bg-brand-200 dark:bg-brand-900/60 group-hover:bg-brand-400"
                      }`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${isToday ? "text-brand-600 dark:text-brand-400" : "text-slate-500"}`}>
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Continue Reading Carousel / Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Continue Reading
          </h2>
          <Link
            href="/library"
            className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            All Books →
          </Link>
        </div>

        {data?.continueReading && data.continueReading.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {data.continueReading.map((item) => (
              <div
                key={item.book.id}
                className="group relative flex items-center gap-3 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <BookThumbnailImg
                  bookId={item.book.id}
                  cover={item.book.cover}
                  title={item.book.title}
                  className="h-14 w-10 sm:h-16 sm:w-11 shrink-0 rounded-lg shadow-xs group-hover:scale-105 transition-transform"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                    {item.book.title}
                  </h3>
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    Page {item.progress.currentPage} of {item.progress.totalPages}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                      style={{ width: `${item.progress.progressPercentage}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Link
                      href={`/read/${item.book.id}`}
                      onMouseEnter={() => prefetchPdf(`/api/books/${item.book.id}/file`)}
                      onTouchStart={() => prefetchPdf(`/api/books/${item.book.id}/file`)}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs transition-all hover:bg-brand-700 active:scale-95"
                    >
                      <span>Read</span>
                      <ChevronRightIcon size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-800">
            <BookOpenIcon size={24} className="mx-auto text-slate-400" />
            <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              No recent reading activity
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pick a book from your library to start reading and tracking progress.
            </p>
          </div>
        )}
      </div>

      {/* Set Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setShowGoalModal(false)}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <XIcon size={16} />
            </button>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Set Daily Reading Target
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Set how many pages you aim to read each day.
            </p>

            <form onSubmit={handleCreateGoal} className="mt-3.5 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Target Pages Per Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <Button type="submit" className="w-full py-2 text-xs mt-1" disabled={submittingGoal}>
                {submittingGoal ? <Spinner size="sm" /> : "Save Goal"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  unit: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
          {value}
        </span>
      </div>
      <div className={`mt-1.5 h-0.5 w-8 rounded-full bg-gradient-to-r ${color}`} />
    </div>
  );
}
