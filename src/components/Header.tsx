"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogoIcon, LogOutIcon, SparklesIcon } from "./ui/icons";

export default function Header() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User";

  return (
    <header className="sticky top-0 z-30 w-full animate-fade-in-down border-b border-slate-200/50 bg-white/80 backdrop-blur-2xl transition-all duration-300 dark:border-slate-800/50 dark:bg-slate-950/80 shadow-sm shadow-slate-900/5">
      <div className="w-full flex items-center justify-between gap-4 px-4 py-3 sm:px-8 md:pl-24 md:pr-10">
        {/* Brand Logo & Title Badge */}
        <Link
          href="/"
          className="group flex items-center gap-3 transition-transform duration-300 active:scale-95"
          title="eBookMine — Read, Understand, Remember"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-brand-400 text-white shadow-lg shadow-brand-500/30 ring-1 ring-white/20 transition-all duration-300 group-hover:rotate-6 group-hover:scale-105 group-hover:shadow-brand-500/50">
            <LogoIcon size={20} />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
            </span>
          </div>

          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent dark:from-brand-300 dark:via-brand-400 dark:to-indigo-400">
                eBookMine
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 sm:inline-flex border border-brand-200/60 dark:border-brand-900/60">
                <SparklesIcon size={11} className="text-amber-500" />
                AI Workspace
              </span>
            </div>
            <span className="hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">
              Personal eBooks & Drive Library
            </span>
          </div>
        </Link>

        {/* User Auth / Profile Badge */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-3 rounded-full border border-slate-200/80 bg-slate-50/80 p-1.5 pr-2.5 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80">
              <div className="flex items-center gap-2">
                {session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={userName}
                    className="h-8 w-8 rounded-full ring-2 ring-brand-500/50 shadow-sm transition-transform duration-300 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-brand-500 font-bold text-xs text-white shadow-md">
                    {userName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="hidden flex-col sm:flex">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[120px] truncate">
                    {userName}
                  </span>
                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ● Connected
                  </span>
                </div>
              </div>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

              <button
                onClick={() => signOut()}
                className="group flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOutIcon size={16} className="transition-transform duration-200 group-hover:scale-110" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-brand-500/25 ring-1 ring-white/20 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-brand-500/40 active:scale-95"
            >
              <LogOutIcon size={15} className="rotate-180" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
