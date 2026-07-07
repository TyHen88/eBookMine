"use client";

import { signIn } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import {
  BookmarkIcon,
  CloudIcon,
  GoogleIcon,
  LogoIcon,
  TagIcon,
} from "./ui/icons";

const FEATURES = [
  {
    icon: CloudIcon,
    title: "Drive-native",
    desc: "PDFs live in your Drive, not our servers.",
  },
  {
    icon: BookmarkIcon,
    title: "Read & track",
    desc: "In-browser reader remembers your place.",
  },
  {
    icon: TagIcon,
    title: "Organize",
    desc: "Tags, search, favorites, collections.",
  },
];

export default function SignIn() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <div className="absolute right-4 top-4 z-10 animate-fade-in-down">
        <ThemeToggle />
      </div>

      {/* Animated indigo aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-100 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950" />
        <div className="absolute -left-24 top-1/4 h-72 w-72 animate-blob rounded-full bg-brand-300/40 blur-3xl dark:bg-brand-600/20" />
        <div
          className="absolute right-0 top-10 h-80 w-80 animate-blob rounded-full bg-brand-400/30 blur-3xl dark:bg-brand-500/20"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-72 w-72 animate-blob rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-700/20"
          style={{ animationDelay: "-12s" }}
        />
      </div>

      <div className="mb-8 text-center">
        <div className="mb-5 inline-flex h-20 w-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-xl shadow-brand-500/40">
          <LogoIcon size={40} />
        </div>
        <h1 className="animate-fade-in-up bg-gradient-to-br from-brand-600 to-brand-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent dark:from-brand-300 dark:to-brand-500 sm:text-5xl">
          eBookMine
        </h1>
        <p
          className="mx-auto mt-4 max-w-md animate-fade-in-up text-slate-600 dark:text-slate-400"
          style={{ animationDelay: "80ms" }}
        >
          Your personal PDF library — stored safely in{" "}
          <span className="font-semibold text-brand-700 dark:text-brand-300">
            your own Google Drive
          </span>
          . We only touch the files we create, nothing else.
        </p>
      </div>

      <button
        onClick={() => signIn("google")}
        className="group flex animate-fade-in-up items-center gap-3 rounded-xl border border-slate-300/70 bg-white/90 px-6 py-3 font-medium text-slate-700 shadow-lg shadow-brand-500/10 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-xl hover:shadow-brand-500/25 active:translate-y-0 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
        style={{ animationDelay: "160ms" }}
      >
        <GoogleIcon
          size={20}
          className="transition-transform duration-300 group-hover:scale-110"
        />
        Sign in with Google
      </button>

      <div className="mt-12 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className="group animate-fade-in-up rounded-2xl border border-slate-200/70 bg-white/60 p-5 text-center backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/10 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-brand-700"
            style={{ animationDelay: `${240 + i * 90}ms` }}
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:scale-110 dark:bg-brand-900/40 dark:text-brand-300">
              <Icon size={22} />
            </div>
            <div className="mt-3 font-semibold">{title}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
