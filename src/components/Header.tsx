"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import AboutButton from "./AboutButton";
import { buttonClass, IconButton } from "./ui";
import { FolderIcon, LogoIcon, LogOutIcon, SettingsIcon } from "./ui/icons";

export default function Header() {
  const { data: session } = useSession();
  const isOwner = (session as any)?.isOwner === true;
  const [folderLink, setFolderLink] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    fetch("/api/folder")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.webViewLink && setFolderLink(d.webViewLink))
      .catch(() => {});
  }, [isOwner]);

  return (
    <header className="sticky top-0 z-30 animate-fade-in-down border-b border-slate-200/60 bg-white/70 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          title="eBookMine — read and explore eBooks online"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-md shadow-brand-500/30 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
            <LogoIcon size={20} />
          </span>
          <span className="leading-tight">
            <span className="block bg-gradient-to-br from-brand-600 to-brand-400 bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-brand-300 dark:to-brand-500">
              eBookMine
            </span>
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Read and explore eBooks online, anytime
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {folderLink && (
            <a
              href={folderLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`hidden sm:inline-flex ${buttonClass({
                variant: "ghost",
                size: "sm",
              })}`}
              title="Open the eBookMine folder in Google Drive"
            >
              <FolderIcon size={17} />
              Drive
            </a>
          )}

          {isOwner && (
            <Link
              href="/henty"
              className={`hidden sm:inline-flex ${buttonClass({
                variant: "ghost",
                size: "sm",
              })}`}
            >
              <SettingsIcon size={17} />
              Manage
            </Link>
          )}

          <AboutButton />
          <ThemeToggle />

          {session?.user && (
            <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-2 dark:border-slate-800">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  className="h-8 w-8 rounded-full ring-2 ring-brand-500/40 transition-transform duration-300 hover:scale-110 hover:ring-brand-500"
                />
              )}
              <IconButton
                onClick={() => signOut()}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOutIcon size={18} />
              </IconButton>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
