"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const { data: session } = useSession();
  const [folderLink, setFolderLink] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/folder")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.webViewLink && setFolderLink(d.webViewLink))
      .catch(() => {});
  }, [session]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📚</span>
          <span className="text-lg font-bold tracking-tight">eBookMine</span>
        </div>
        <div className="flex items-center gap-3">
          {folderLink && (
            <a
              href={folderLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex"
              title="Open the eBookMine folder in Google Drive"
            >
              📁 Drive folder
            </a>
          )}
          <ThemeToggle />
          {session?.user ? (
            <div className="flex items-center gap-2">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  className="h-8 w-8 rounded-full"
                />
              )}
              <button
                onClick={() => signOut()}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Owner sign-in to manage the library"
            >
              Manage
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
