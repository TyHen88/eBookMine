"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BookOpenIcon,
  GridIcon,
  LogoIcon,
  LogOutIcon,
  SettingsIcon,
  SparklesIcon,
  TranslateIcon,
  UserIcon,
  UsersIcon,
} from "./ui/icons";

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isAuthenticated = status === "authenticated";
  const isOwner =
    (session as any)?.isOwner === true ||
    (session?.user as any)?.role === "ADMIN";
  const userName =
    session?.user?.name || session?.user?.email?.split("@")[0] || "User";

  const topNavItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: GridIcon,
      active: pathname === "/",
    },
    {
      href: "/library",
      label: "Library",
      icon: BookOpenIcon,
      active: pathname === "/library" || pathname?.startsWith("/book/"),
    },
    {
      href: "/translate",
      label: "Translate",
      icon: TranslateIcon,
      active: pathname === "/translate",
    },
    ...(isAuthenticated
      ? [
          {
            href: "/groups",
            label: "Groups",
            icon: UsersIcon,
            active:
              pathname === "/groups" || pathname?.startsWith("/groups/"),
          },
          {
            href: "/profile",
            label: "Profile",
            icon: UserIcon,
            active: pathname === "/profile",
          },
        ]
      : []),
  ];

  const activeSection =
    topNavItems.find((i) => i.active)?.label ||
    (pathname === "/profile"
      ? "Profile"
      : pathname === "/admin"
      ? "Admin"
      : "Workspace");

  return (
    <header
      className="sticky top-0 z-30 w-full border-b border-slate-200/70 bg-white/90 shadow-xs shadow-slate-900/5 backdrop-blur-xl transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-950/90"
      style={{ transform: "translateZ(0)", backfaceVisibility: "hidden" }}
    >
      <div className="mx-auto flex w-full max-w-[1380px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6 md:pl-24 md:pr-10">
        {/* Brand Logo & Active Section Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="group flex items-center gap-3 transition-transform duration-300 active:scale-95"
            title="eBookMine — Read, Understand, Remember"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-400 text-white shadow-md shadow-brand-500/25 ring-1 ring-white/20 transition-all duration-300 group-hover:rotate-3 group-hover:scale-105">
              <LogoIcon size={20} />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-950" />
              </span>
            </div>

            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 bg-clip-text text-lg sm:text-xl font-black tracking-tight text-transparent dark:from-brand-300 dark:via-brand-400 dark:to-indigo-400">
                  eBookMine
                </span>
                <span className="hidden items-center gap-1 rounded-full border border-brand-200/60 bg-brand-50/90 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:border-brand-900/60 dark:bg-brand-950/70 dark:text-brand-300 sm:inline-flex">
                  <SparklesIcon size={10} className="text-amber-500" />
                  <span>AI Workspace</span>
                </span>
              </div>
              <span className="hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">
                Personal eBook Library & Study Suite
              </span>
            </div>
          </Link>

          {/* Compact Mobile / Tablet Section Breadcrumb Pill */}
          <span className="inline-flex lg:hidden items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800/90 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span>{activeSection}</span>
          </span>
        </div>

        {/* Center Inline Navigation Pill Bar (Desktop) */}
        <nav
          aria-label="Header Quick Navigation"
          className="hidden lg:flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/75 p-1 dark:border-slate-800/90 dark:bg-slate-900/80"
        >
          {topNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  item.active
                    ? "bg-white text-brand-600 shadow-xs ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-white dark:ring-slate-700/80"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
                }`}
              >
                <Icon
                  size={14}
                  className={
                    item.active
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-slate-400 dark:text-slate-500"
                  }
                />
                <span>{item.label}</span>
                {item.active && (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-brand-500 dark:bg-brand-400"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Auth / Profile & Quick Admin Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 rounded-full border border-slate-200/85 bg-slate-50/90 p-1 pl-1.5 pr-2 shadow-xs backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/90">
              <Link
                href="/profile"
                aria-current={pathname === "/profile" ? "page" : undefined}
                className="group/user flex items-center gap-2 rounded-full pr-1 transition-opacity hover:opacity-95"
                title="View My Profile & Favorites"
              >
                {session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={userName}
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-brand-500/40 shadow-xs transition-transform duration-300 group-hover/user:scale-105"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-xs font-bold text-white shadow-xs transition-transform duration-300 group-hover/user:scale-105">
                    {userName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="hidden flex-col sm:flex">
                  <span className="max-w-[115px] truncate text-xs font-bold text-slate-800 transition-colors group-hover/user:text-brand-600 dark:text-slate-100 dark:group-hover/user:text-brand-300">
                    {userName}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Profile & Favs
                  </span>
                </div>
              </Link>

              {isOwner && (
                <>
                  <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-800" />
                  <Link
                    href="/admin"
                    aria-current={pathname === "/admin" ? "page" : undefined}
                    title="Admin Control Center"
                    aria-label="Admin Control Center"
                    className={`hidden sm:flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                      pathname === "/admin"
                        ? "bg-brand-600 text-white"
                        : "text-slate-500 hover:bg-brand-50 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-brand-950/60 dark:hover:text-brand-300"
                    }`}
                  >
                    <SettingsIcon size={15} />
                  </Link>
                </>
              )}

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

              <button
                type="button"
                onClick={() => signOut()}
                className="group flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOutIcon
                  size={15}
                  className="transition-transform duration-200 group-hover:scale-110"
                />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-brand-500/25 ring-1 ring-white/20 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-brand-500/40 active:scale-95"
            >
              <UserIcon size={14} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
