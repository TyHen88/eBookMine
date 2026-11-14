"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DashboardData } from "@/lib/dashboardService";
import { Button, Spinner, BookLoader } from "./ui";
import { useToast } from "./ui/Toast";
import AuthPromptModal from "./AuthPromptModal";
import BookThumbnailImg from "./BookThumbnailImg";
import { prefetchPdf } from "@/lib/pdfCache";
import {
  BookOpenIcon,
  ChevronRightIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
  CheckIcon,
  InfoIcon,
  ClockIcon,
  FileTextIcon,
  SlidersIcon,
  TranslateIcon,
  UsersIcon,
  StarIcon,
} from "./ui/icons";

const GOAL_PRESETS = [15, 25, 50, 100, 250, 800];

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

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const goalDialogTitleId = useId();

  const userName =
    session?.user?.name || session?.user?.email?.split("@")[0] || "Reader";

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setData(d);
          if (d?.goals?.[0]?.target) {
            setGoalTarget(d.goals[0].target);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Sync native <dialog> modal state and light-dismiss fallback when closedBy is unsupported
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (showGoalModal) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [showGoalModal]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      setShowGoalModal(false);
    };
    dialog.addEventListener("close", handleClose);

    let cleanupFallback: (() => void) | undefined;
    if (
      typeof HTMLDialogElement !== "undefined" &&
      !("closedBy" in HTMLDialogElement.prototype)
    ) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) {
          dialog.close();
        }
      };
      dialog.addEventListener("pointerdown", onPointerDown);
      dialog.addEventListener("pointerup", onPointerUp);
      cleanupFallback = () => {
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("pointerup", onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupFallback?.();
    };
  }, []);

  const handleOpenSetGoal = () => {
    if (!isAuthenticated) {
      showToast("Please sign in to customize your reading goals", "info");
      setShowAuthModal(true);
      return;
    }
    if (data?.goals?.[0]?.target) {
      setGoalTarget(data.goals[0].target);
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
        showToast("Reading goal updated successfully!", "success");
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
      <div className="flex h-80 items-center justify-center">
        <BookLoader label="Loading Workspace & Goal Metrics..." />
      </div>
    );
  }

  const stats = data?.statistics;
  const booksCompleted = stats?.booksCompleted ?? 0;
  const booksReading = stats?.booksReading ?? (data?.continueReading?.length || 0);
  const pagesRead = stats?.pagesRead ?? 0;
  const readingTimeMinutes = stats?.readingTimeMinutes ?? Math.round(pagesRead * 2.5);
  const readingHours = Math.floor(readingTimeMinutes / 60);
  const readingMins = readingTimeMinutes % 60;
  const currentStreak = stats?.currentStreak ?? 0;
  const longestStreak = stats?.longestStreak ?? currentStreak;
  const avgQuizScore = stats?.avgQuizScore ?? 0;
  const flashcardsReviewed = stats?.flashcardsReviewed ?? 0;

  const activeGoal = data?.goals?.[0];
  const goalTargetVal = activeGoal?.target || 25;
  const goalCurrentVal =
    activeGoal?.current || Math.min(pagesRead, goalTargetVal);
  const goalPct = Math.min(100, Math.round((goalCurrentVal / goalTargetVal) * 100));
  const goalRemaining = Math.max(0, goalTargetVal - goalCurrentVal);

  // Weekly reading activity calculated from real user data (Mon = 0 .. Sun = 6)
  const weeklyDays = stats?.dailyDaysLabels || [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ];
  const activityData = stats?.dailyPagesRead || [0, 0, 0, 0, 0, 0, 0];
  const weeklyActiveBools = stats?.weeklyActivity || [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ];
  const todayIdx = (new Date().getDay() + 6) % 7;
  const maxPages = Math.max(...activityData, 20);
  const weeklyTotalPages = activityData.reduce((acc, v) => acc + v, 0);
  const activeDaysCount = weeklyActiveBools.filter(Boolean).length;
  const dailyAvgPages = Math.round(weeklyTotalPages / 7);

  const topContinue = data?.continueReading?.[0] ?? null;
  const formattedToday = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in pb-10">
      {/* Auth Prompt Modal */}
      {showAuthModal && (
        <AuthPromptModal onClose={() => setShowAuthModal(false)} />
      )}

      {/* Hero Greeting & Momentum Workspace Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-600 via-indigo-600 to-slate-900 p-5 sm:p-7 text-white shadow-xl shadow-brand-600/15 dark:border-brand-500/25">
        {/* Decorative ambient light & mesh accents */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-brand-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="relative z-10 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Greeting, Value Prop & Primary Actions */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
                <SparklesIcon size={12} className="text-amber-300" />
                <span>
                  {isAuthenticated
                    ? `Welcome back, ${userName}!`
                    : "Welcome to eBookMine Library"}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/30 px-2.5 py-1 text-[11px] font-medium text-brand-100 ring-1 ring-white/10 backdrop-blur-md">
                <ClockIcon size={11} className="text-brand-200" />
                <span>{formattedToday}</span>
              </span>
              {booksReading > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  {booksReading} {booksReading === 1 ? "Book" : "Books"} Active
                </span>
              )}
            </div>

            <div>
              <h1 className="font-black tracking-tight text-white [font-size:clamp(1.35rem,1.05rem+1.3vw,2.1rem)] leading-tight">
                {isAuthenticated
                  ? "Keep Up Your Reading Momentum"
                  : "Read, Understand & Master Any PDF"}
              </h1>
              <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-brand-100/90 leading-relaxed">
                {isAuthenticated
                  ? "Track daily reading targets, review AI-generated flashcards, and build consistent study streaks across your personal library."
                  : "Sign in to sync your personal eBook library, save reading progress across devices, and study with AI RAG tools."}
              </p>
            </div>

            {/* Action Buttons & Quick Workspace Pills */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                href="/library"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs sm:text-sm font-bold text-brand-700 shadow-md shadow-slate-950/15 transition-all hover:bg-brand-50 hover:-translate-y-0.5 active:scale-95"
              >
                <BookOpenIcon size={15} />
                <span>Open Library</span>
              </Link>

              <button
                type="button"
                onClick={handleOpenSetGoal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs sm:text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur-md transition-all hover:bg-white/25 hover:-translate-y-0.5 active:scale-95"
              >
                <PlusIcon size={15} />
                <span>Set Goal</span>
              </button>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("open-ai-bot"))}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950/35 px-3.5 py-2 text-xs sm:text-sm font-semibold text-brand-100 ring-1 ring-white/15 backdrop-blur-md transition-all hover:bg-slate-950/50 hover:text-white"
              >
                <SparklesIcon size={14} className="text-amber-300" />
                <span>Summon AI Bot</span>
              </button>
            </div>
          </div>

          {/* Right Column: Quick Resume Spotlight Card */}
          <div className="lg:col-span-5 xl:col-span-4">
            {topContinue ? (
              <div className="rounded-2xl border border-white/20 bg-slate-950/35 p-3.5 sm:p-4 backdrop-blur-xl shadow-lg">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Jump Back In
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-extrabold text-white">
                    {topContinue.progress.progressPercentage}% Complete
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  <BookThumbnailImg
                    bookId={topContinue.book.id}
                    cover={topContinue.book.cover}
                    title={topContinue.book.title}
                    className="h-16 w-12 sm:h-20 sm:w-14 shrink-0 rounded-lg shadow-md ring-1 ring-white/25"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-xs sm:text-sm font-bold text-white">
                      {topContinue.book.title}
                    </h2>
                    <p className="truncate text-[11px] text-brand-200/85 mt-0.5">
                      {topContinue.book.author || "Personal Library"}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-white/90">
                      Page {topContinue.progress.currentPage} of{" "}
                      {topContinue.progress.totalPages}
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-300 via-brand-300 to-white transition-all duration-500"
                        style={{
                          width: `${Math.max(
                            4,
                            topContinue.progress.progressPercentage
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-white/10">
                  <Link
                    href={`/book/${topContinue.book.id}`}
                    className="text-[11px] font-semibold text-brand-200 hover:text-white transition-colors"
                  >
                    Book Details & AI
                  </Link>
                  <Link
                    href={`/read/${topContinue.book.id}`}
                    onMouseEnter={() =>
                      prefetchPdf(`/api/books/${topContinue.book.id}/file`)
                    }
                    onTouchStart={() =>
                      prefetchPdf(`/api/books/${topContinue.book.id}/file`)
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-brand-700 shadow-xs transition-all hover:bg-brand-50 active:scale-95"
                  >
                    <span>Resume Reading</span>
                    <ChevronRightIcon size={13} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-slate-950/30 p-4 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-amber-300 ring-1 ring-white/20">
                    <BookOpenIcon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xs sm:text-sm font-bold text-white">
                      Ready for Your Next Chapter?
                    </h2>
                    <p className="mt-0.5 text-[11px] text-brand-100/85">
                      Open any book in your library to track pages, highlights, and AI notes automatically.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px] text-brand-100">
                  <span>Daily Target: {goalTargetVal} pages</span>
                  <Link
                    href="/library"
                    className="font-bold text-white hover:underline inline-flex items-center gap-1"
                  >
                    <span>Browse Books</span>
                    <ChevronRightIcon size={12} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Guest Mode Onboarding & Showcase Banner */}
      {!isAuthenticated && (
        <div className="rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-50/90 via-white to-brand-50/50 p-4 shadow-xs dark:border-amber-500/20 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-300 shrink-0 ring-1 ring-amber-400/30">
                <InfoIcon size={18} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Unlock Full AI Study Features & Cloud Library Sync
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
                  Sign in to save highlights, personal notes, chapter quiz scores, and daily streaks.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAuthModal(true)}
              className="py-2 px-4 text-xs shrink-0"
            >
              Sign In Now
            </Button>
          </div>
        </div>
      )}

      {/* Top 4 Metric Cards Grid */}
      <section
        aria-label="Key Reading Statistics"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <MetricCard
          label="Completed"
          value={booksCompleted}
          unit="Books"
          subtitle={`${booksReading} currently in progress`}
          accentClass="from-blue-500 to-indigo-600"
          iconBgClass="bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 ring-blue-500/20"
          icon={<BookOpenIcon size={18} />}
        />
        <MetricCard
          label="Pages Read"
          value={pagesRead.toLocaleString()}
          unit="Pages"
          subtitle={
            readingHours > 0
              ? `~${readingHours}h ${readingMins}m reading time`
              : `~${readingMins}m reading time`
          }
          accentClass="from-brand-500 to-purple-600"
          iconBgClass="bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400 ring-brand-500/20"
          icon={<FileTextIcon size={18} />}
        />
        <MetricCard
          label="Study Streak"
          value={`${currentStreak} ${currentStreak === 1 ? "Day" : "Days"}`}
          unit={currentStreak > 0 ? "Active" : "Start Today"}
          subtitle={`Best record: ${longestStreak} ${
            longestStreak === 1 ? "day" : "days"
          }`}
          accentClass="from-amber-500 to-orange-600"
          iconBgClass="bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 ring-amber-500/20"
          icon={<FlameIcon size={18} />}
        />
        <MetricCard
          label="Quiz Mastery"
          value={`${avgQuizScore}%`}
          unit="Avg Score"
          subtitle={`${flashcardsReviewed} flashcards reviewed`}
          accentClass="from-emerald-500 to-teal-600"
          iconBgClass="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 ring-emerald-500/20"
          icon={<BoltIcon size={18} />}
        />
      </section>

      {/* Main Analytics Grid: Daily Goal Progress (4 cols) & Weekly Reading Activity (8 cols) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Active Reading Goal Card */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/90 dark:bg-slate-900/90 lg:col-span-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Daily Goal Progress
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Your daily page reading target
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenSetGoal}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 transition-colors hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-800/70 dark:text-brand-300 dark:hover:bg-slate-800"
            >
              <SlidersIcon size={12} />
              <span>Configure</span>
            </button>
          </div>

          <div className="my-5 flex flex-col items-center justify-center text-center">
            {/* Upgraded SVG Ring Gauge */}
            <div className="relative flex h-36 w-36 sm:h-40 sm:w-40 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <defs>
                  <linearGradient
                    id="goalRingGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="50%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
                <path
                  className="text-slate-100 dark:text-slate-800/90"
                  strokeWidth="3.2"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  stroke="url(#goalRingGrad)"
                  strokeDasharray={`${goalPct}, 100`}
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-1000 ease-out"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {goalPct}%
                </span>
                <span className="mt-0.5 rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-600 dark:bg-brand-950/80 dark:text-brand-300">
                  {goalPct >= 100 ? "Completed" : "Goal"}
                </span>
              </div>
            </div>

            <p className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
              {goalCurrentVal.toLocaleString()} / {goalTargetVal.toLocaleString()}{" "}
              Pages Today
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {goalPct >= 100
                ? "Daily reading goal achieved! Great job!"
                : `${goalRemaining.toLocaleString()} more ${
                    goalRemaining === 1 ? "page" : "pages"
                  } to reach your target.`}
            </p>
          </div>

          {/* Goal Breakdown Footer */}
          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="rounded-xl bg-slate-50/90 px-3 py-2 dark:bg-slate-800/50">
              <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Daily Target
              </span>
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                {goalTargetVal.toLocaleString()} pages
              </span>
            </div>
            <div className="rounded-xl bg-slate-50/90 px-3 py-2 dark:bg-slate-800/50">
              <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Remaining
              </span>
              <span className="text-xs font-extrabold text-brand-600 dark:text-brand-400">
                {goalRemaining === 0
                  ? "Done!"
                  : `${goalRemaining.toLocaleString()} pages`}
              </span>
            </div>
          </div>
        </div>

        {/* Weekly Reading Activity Bar Chart */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/90 dark:bg-slate-900/90 lg:col-span-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  Weekly Reading Activity
                </h2>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-bold text-brand-600 dark:bg-brand-950/90 dark:text-brand-300 border border-brand-200/50 dark:border-brand-800/50">
                  This Week
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Pages read each day from Monday to Sunday
              </p>
            </div>

            {/* Weekly Summary Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Week Total
                </span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {weeklyTotalPages.toLocaleString()} pages
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Daily Avg
                </span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {dailyAvgPages} pages
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Active Days
                </span>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {activeDaysCount} / 7 days
                </span>
              </div>
            </div>
          </div>

          {/* 7-Day Bar Chart Area */}
          <div className="relative mt-6 pt-2">
            {/* Subtle horizontal reference grid lines */}
            <div className="pointer-events-none absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between">
              <div className="border-b border-dashed border-slate-100 dark:border-slate-800/70" />
              <div className="border-b border-dashed border-slate-100 dark:border-slate-800/70" />
              <div className="border-b border-dashed border-slate-100 dark:border-slate-800/70" />
            </div>

            <div className="relative z-10 grid grid-cols-7 gap-2 sm:gap-3.5 items-end">
              {weeklyDays.map((day, idx) => {
                const pages = activityData[idx] || 0;
                const isToday = idx === todayIdx;
                const isActive = pages > 0 || weeklyActiveBools[idx];
                const barHeight =
                  pages > 0
                    ? Math.max(18, Math.min(100, Math.round((pages / maxPages) * 100)))
                    : isToday
                    ? 12
                    : 8;

                return (
                  <div
                    key={`${day}-${idx}`}
                    className="group flex flex-col items-center gap-2"
                  >
                    {/* Page count label above bar */}
                    <span
                      className={`text-[10px] font-bold transition-all ${
                        pages > 0
                          ? "text-brand-600 dark:text-brand-300"
                          : isToday
                          ? "text-slate-600 dark:text-slate-300"
                          : "text-slate-400 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400"
                      }`}
                    >
                      {pages}p
                    </span>

                    {/* Bar Track */}
                    <div
                      className={`relative flex h-32 sm:h-36 w-full max-w-[44px] items-end overflow-hidden rounded-2xl p-1 transition-colors ${
                        isToday
                          ? "bg-brand-50/80 ring-1 ring-brand-500/30 dark:bg-brand-950/40 dark:ring-brand-400/30"
                          : "bg-slate-100/90 dark:bg-slate-800/70 group-hover:bg-slate-200/70 dark:group-hover:bg-slate-800"
                      }`}
                    >
                      <div
                        className={`w-full rounded-xl transition-all duration-700 ${
                          pages > 0
                            ? isToday
                              ? "bg-gradient-to-t from-brand-600 via-brand-500 to-indigo-400 shadow-md shadow-brand-500/30"
                              : "bg-gradient-to-t from-brand-600/85 to-brand-400/85 group-hover:from-brand-500 group-hover:to-indigo-400"
                            : isToday
                            ? "bg-brand-400/50 dark:bg-brand-500/40"
                            : "bg-slate-200/80 dark:bg-slate-700/50"
                        }`}
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>

                    {/* Day Label & Active Indicator */}
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`text-[11px] font-bold ${
                          isToday
                            ? "text-brand-600 dark:text-brand-400"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {day}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isActive
                            ? "bg-emerald-500"
                            : isToday
                            ? "bg-brand-500"
                            : "bg-transparent"
                        }`}
                        title={
                          isActive
                            ? "Reading logged"
                            : isToday
                            ? "Today"
                            : undefined
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card Footer Insight */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                <span>Today ({weeklyDays[todayIdx]})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Active study day</span>
              </span>
            </div>
            <span>
              Total study time:{" "}
              <strong className="font-bold text-slate-700 dark:text-slate-200">
                {readingHours > 0
                  ? `${readingHours}h ${readingMins}m`
                  : `${readingMins} mins`}
              </strong>
            </span>
          </div>
        </div>
      </section>

      {/* Continue Reading Section */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Continue Reading
            </h2>
            {data?.continueReading && data.continueReading.length > 0 && (
              <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {data.continueReading.length}
              </span>
            )}
          </div>
          <Link
            href="/library"
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            <span>All Books</span>
            <ChevronRightIcon size={14} />
          </Link>
        </div>

        {data?.continueReading && data.continueReading.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.continueReading.map((item) => {
              const pct = Math.min(
                100,
                Math.max(0, Math.round(item.progress.progressPercentage || 0))
              );
              const pagesLeft = Math.max(
                0,
                (item.progress.totalPages || 0) -
                  (item.progress.currentPage || 0)
              );

              return (
                <div
                  key={item.book.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-300/80 hover:shadow-md dark:border-slate-800/90 dark:bg-slate-900/90 dark:hover:border-brand-700/60"
                >
                  <div className="flex items-start gap-3.5">
                    <Link
                      href={`/read/${item.book.id}`}
                      onMouseEnter={() =>
                        prefetchPdf(`/api/books/${item.book.id}/file`)
                      }
                      className="shrink-0"
                    >
                      <BookThumbnailImg
                        bookId={item.book.id}
                        cover={item.book.cover}
                        title={item.book.title}
                        className="h-20 w-14 sm:h-22 sm:w-16 rounded-xl shadow-sm ring-1 ring-slate-900/10 transition-transform duration-300 group-hover:scale-105 dark:ring-white/10"
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/read/${item.book.id}`}
                          className="min-w-0 flex-1"
                        >
                          <h3
                            className="line-clamp-1 text-xs sm:text-sm font-bold text-slate-900 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400 transition-colors"
                            title={item.book.title}
                          >
                            {item.book.title}
                          </h3>
                        </Link>
                        <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-600 dark:bg-brand-950/90 dark:text-brand-300">
                          {pct}%
                        </span>
                      </div>

                      <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {item.book.author && item.book.author !== "Unknown"
                          ? item.book.author
                          : "Personal eBook"}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        <span>
                          Page {item.progress.currentPage} of{" "}
                          {item.progress.totalPages}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {pagesLeft}p left
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-400 transition-all duration-500"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800/80">
                    <Link
                      href={`/book/${item.book.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300 transition-colors"
                    >
                      <SparklesIcon size={12} className="text-amber-500" />
                      <span>Book Info & AI</span>
                    </Link>

                    <Link
                      href={`/read/${item.book.id}`}
                      onMouseEnter={() =>
                        prefetchPdf(`/api/books/${item.book.id}/file`)
                      }
                      onTouchStart={() =>
                        prefetchPdf(`/api/books/${item.book.id}/file`)
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-brand-500 active:scale-95"
                    >
                      <span>Read</span>
                      <ChevronRightIcon size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-400">
              <BookOpenIcon size={22} />
            </div>
            <p className="mt-2.5 text-sm font-bold text-slate-800 dark:text-slate-200">
              No active books in progress
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              Pick a book from your library to start reading, highlighting key concepts, and tracking your daily progress.
            </p>
            <Link
              href="/library"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-brand-500"
            >
              <BookOpenIcon size={14} />
              <span>Browse Library</span>
            </Link>
          </div>
        )}
      </section>

      {/* Quick AI Workspace & Tools Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
            Workspace Shortcuts
          </h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Tools to read, translate, and collaborate
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href="/library"
            className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 dark:hover:border-brand-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-transform group-hover:scale-105 dark:bg-brand-950/80 dark:text-brand-400">
              <BookOpenIcon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                eBook Library
              </h3>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                Browse & manage PDFs
              </p>
            </div>
          </Link>

          <Link
            href="/translate"
            className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 dark:hover:border-blue-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-105 dark:bg-blue-950/80 dark:text-blue-400">
              <TranslateIcon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                AI Translate
              </h3>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                English & Khmer translation
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-ai-bot"))}
            className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 dark:hover:border-amber-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-transform group-hover:scale-105 dark:bg-amber-950/80 dark:text-amber-400">
              <SparklesIcon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                Floating AI Bot
              </h3>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                Summon companion chat
              </p>
            </div>
          </button>

          <Link
            href={isAuthenticated ? "/groups" : "/login"}
            className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 dark:hover:border-emerald-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-105 dark:bg-emerald-950/80 dark:text-emerald-400">
              <UsersIcon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                Reading Groups
              </h3>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                Shared folders & study clubs
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* Native <dialog> Modal for Setting Reading Goal */}
      <dialog
        ref={dialogRef}
        aria-labelledby={goalDialogTitleId}
        {...({ closedby: "any" } as any)}
        className="m-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id={goalDialogTitleId}
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Configure Reading Goal
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Choose your target pages per day to stay consistent.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGoalModal(false)}
            aria-label="Close goal configuration dialog"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleCreateGoal} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="goal-target-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Target Pages Per Day
            </label>
            <input
              id="goal-target-input"
              type="number"
              min="1"
              max="2000"
              autoFocus
              value={goalTarget}
              onChange={(e) => setGoalTarget(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-brand-400"
            />
          </div>

          {/* Quick Preset Pills */}
          <div>
            <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Quick Presets
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {GOAL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setGoalTarget(preset)}
                  className={`rounded-xl py-1.5 text-xs font-bold transition-all ${
                    goalTarget === preset
                      ? "bg-brand-600 text-white shadow-xs"
                      : "border border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {preset}p
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowGoalModal(false)}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <Button
              type="submit"
              className="px-5 py-2 text-xs"
              disabled={submittingGoal}
            >
              {submittingGoal ? <Spinner size="sm" /> : "Save Target"}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  subtitle,
  icon,
  accentClass,
  iconBgClass,
}: {
  label: string;
  value: string | number;
  unit: string;
  subtitle: string;
  icon: ReactNode;
  accentClass: string;
  iconBgClass: string;
}) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800/90 dark:bg-slate-900/90">
      {/* Top thin gradient accent bar */}
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentClass} opacity-85`}
      />

      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {label}
          </span>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {value}
            </span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {unit}
            </span>
          </div>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-110 ${iconBgClass}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-medium text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
        <span className="truncate">{subtitle}</span>
      </div>
    </div>
  );
}

function FlameIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function BoltIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
