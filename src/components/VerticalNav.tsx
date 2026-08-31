"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import AboutButton from "./AboutButton";
import {
  BookOpenIcon,
  FolderIcon,
  LogoIcon,
  SettingsIcon,
  SparklesIcon,
  GridIcon,
  TranslateIcon,
  UsersIcon,
  UserIcon,
} from "./ui/icons";

export default function VerticalNav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isAuthenticated = status === "authenticated";
  const isOwner = (session as any)?.isOwner === true;
  const [folderLink, setFolderLink] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !isOwner) return;
    fetch("/api/folder")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.webViewLink && setFolderLink(d.webViewLink))
      .catch(() => {});
  }, [status, isOwner]);

  // Don't render vertical nav inside reader view to preserve reader viewport space
  if (pathname?.startsWith("/read/")) {
    return null;
  }

  const navItems = [
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
      active: pathname === "/library",
    },
    {
      href: "/translate",
      label: "eBookMine Translate",
      icon: TranslateIcon,
      active: pathname === "/translate",
      iconClass: "text-blue-500",
    },
    ...(isAuthenticated
      ? [
          {
            href: "/groups",
            label: "Reading Groups",
            icon: UsersIcon,
            active: pathname === "/groups" || pathname?.startsWith("/groups/"),
            iconClass: "text-emerald-500",
          },
          {
            href: "/ai-tutor",
            label: "AI Assistant",
            icon: SparklesIcon,
            active: pathname === "/ai-tutor",
            iconClass: "text-amber-500",
          },
          {
            href: "/profile",
            label: "My Profile & Favorites",
            icon: UserIcon,
            active: pathname === "/profile",
            iconClass: "text-indigo-500",
          },
        ]
      : []),
  ];


  return (
    <>
      {/* Desktop Floating Vertical Navigation Dock (Left side) */}
      <aside
        aria-label="Main Navigation"
        style={{ transform: "translate(0, -50%) translateZ(0)", backfaceVisibility: "hidden" }}
        className="fixed left-5 top-1/2 z-40 hidden flex-col items-center gap-3 rounded-3xl border border-slate-200/80 bg-white/95 p-3 shadow-2xl shadow-brand-500/10 backdrop-blur-md transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-950/95 md:flex"
      >


        {/* Brand Logo */}
        <Link
          href="/"
          className="group relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-md shadow-brand-500/30 transition-transform duration-300 hover:rotate-6 hover:scale-110 active:scale-95"
          title="eBookMine — Dashboard"
        >
          <LogoIcon size={22} />
          {/* Tooltip */}
          <span className="pointer-events-none absolute left-full ml-3 scale-95 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
            eBookMine
          </span>
        </Link>

        <div className="h-px w-8 bg-slate-200 dark:bg-slate-800" />

        {/* Primary Navigation Links */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold transition-all duration-300 ${
                  item.active
                    ? "bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/35 scale-105"
                    : "text-slate-600 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-brand-300"
                }`}
              >
                <Icon size={20} className={item.active ? "text-white" : item.iconClass} />

                {/* Floating Tooltip */}
                <span className="pointer-events-none absolute left-full ml-3 scale-95 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Secondary Links (Drive, Admin) */}
        {(folderLink || isOwner) && (
          <>
            <div className="h-px w-8 bg-slate-200 dark:bg-slate-800" />
            <div className="flex flex-col gap-2">
              {folderLink && isOwner && (
                <a
                  href={folderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex h-11 w-11 items-center justify-center rounded-2xl text-slate-600 transition-all duration-300 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-brand-300"
                  title="Open Cloud Library Folder"
                >
                  <FolderIcon size={20} />
                  <span className="pointer-events-none absolute left-full ml-3 scale-95 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
                    Cloud Folder
                  </span>
                </a>
              )}

              {isOwner && (
                <Link
                  href="/admin"
                  className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold transition-all duration-300 ${
                    pathname === "/admin"
                      ? "bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/35 scale-105"
                      : "text-slate-600 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-brand-300"
                  }`}
                >
                  <SettingsIcon size={20} />
                  <span className="pointer-events-none absolute left-full ml-3 scale-95 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
                    Admin Settings
                  </span>
                </Link>
              )}
            </div>
          </>
        )}

        <div className="h-px w-8 bg-slate-200 dark:bg-slate-800" />

        {/* Footer Actions (Theme, About) */}
        <div className="flex flex-col items-center gap-2">
          <ThemeToggle />
          <AboutButton />
        </div>
      </aside>

      {/* Mobile Floating Bottom Navigation Dock (Icons Only) */}
      <div className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-around rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/95 md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                item.active
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 scale-105"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={20} className={item.active ? "text-brand-600 dark:text-brand-400" : item.iconClass} />
            </Link>
          );
        })}

        {isOwner && (
          <Link
            href="/admin"
            title="Admin Settings"
            className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
              pathname === "/admin"
                ? "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 scale-105"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <SettingsIcon size={20} />
          </Link>
        )}


        <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-800">
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
