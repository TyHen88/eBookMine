"use client";

import { signIn } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function SignIn() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      {/* decorative gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900" />

      <div className="mb-8 text-center">
        <div className="mb-4 text-6xl">📚</div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          eBookMine
        </h1>
        <p className="mx-auto mt-4 max-w-md text-slate-600 dark:text-slate-400">
          Your personal PDF library — stored safely in{" "}
          <span className="font-semibold">your own Google Drive</span>. We only
          touch the files we create, nothing else.
        </p>
      </div>

      <button
        onClick={() => signIn("google")}
        className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 16 3 9.1 7.6 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9.1 42.4 16 45 24 45z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C42.6 35.8 45 30.4 45 24c0-1.2-.1-2.3-.4-3.5z" />
        </svg>
        Sign in with Google
      </button>

      <div className="mt-12 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["☁️", "Drive-native", "PDFs live in your Drive, not our servers."],
          ["🔖", "Read & track", "In-browser reader remembers your place."],
          ["🏷️", "Organize", "Tags, search, favorites, collections."],
        ].map(([icon, title, desc]) => (
          <div
            key={title}
            className="rounded-xl border border-slate-200 bg-white/60 p-4 text-center dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div className="text-2xl">{icon}</div>
            <div className="mt-1 font-semibold">{title}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
