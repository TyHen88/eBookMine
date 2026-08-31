"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import Header from "@/components/Header";
import VerticalNav from "@/components/VerticalNav";
import GroupCard from "@/components/groups/GroupCard";
import {
  StarIcon,
  BookOpenIcon,
  UsersIcon,
  ClockIcon,
  CheckIcon,
  LogOutIcon,
  UserIcon,
  SparklesIcon,
  CrownIcon,
  TagIcon,
} from "@/components/ui/icons";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [profileData, setProfileData] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"favorites" | "in-progress" | "groups">("favorites");

  const fetchProfile = async () => {
    try {
      const [pRes, gRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/groups"),
      ]);

      if (pRes.ok) {
        const pData = await pRes.json();
        setProfileData(pData);
      }

      if (gRes.ok) {
        const gData = await gRes.json();
        setGroups(gData.myGroups || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchProfile();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  const handleToggleFavorite = async (bookId: string, currentFav: boolean) => {
    // Optimistically update
    if (profileData) {
      setProfileData({
        ...profileData,
        favoriteBooks: profileData.favoriteBooks.filter((b: any) => b.id !== bookId),
        stats: {
          ...profileData.stats,
          favoritesCount: Math.max(0, (profileData.stats.favoritesCount || 1) - 1),
        },
      });
    }

    try {
      await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: !currentFav }),
      });
    } catch {
      fetchProfile();
    }
  };

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
        <Header />
        <VerticalNav />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-20 md:pl-24 text-center">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-12 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 mx-auto mb-4">
              <UserIcon size={32} />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              Sign In to View Your Profile
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Sign in to manage your favorites, view your reading progress, and access your reading groups.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-brand-500/25 transition-all hover:scale-105"
            >
              Sign In
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const user = profileData?.user || session?.user;
  const stats = profileData?.stats || {
    favoritesCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    groupsCount: 0,
  };
  const favorites = profileData?.favoriteBooks || [];
  const inProgress = profileData?.recentProgresses || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <Header />
      <VerticalNav />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-3 sm:pt-6 pb-28 md:pb-12 md:pl-24">
        {/* Profile Hero Section */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-indigo-50/15 to-brand-50/20 p-3.5 sm:p-5 shadow-xs backdrop-blur-xl dark:border-slate-800/80 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-indigo-950/20 mb-3.5 sm:mb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
            {/* User Info */}
            <div className="flex items-center gap-3 sm:gap-4">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover ring-2 ring-white dark:ring-slate-800 shadow-sm"
                />
              ) : (
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white font-black text-lg sm:text-xl shadow-sm">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                    {user?.name || "Book Reader"}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200/60">
                    <CrownIcon size={9} className="text-amber-500" />
                    {user?.role || "READER"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Quick Action */}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-xs font-bold text-slate-600 shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400 active:scale-95"
            >
              <LogOutIcon size={13} />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="rounded-xl border border-slate-100 bg-white/70 p-2.5 sm:p-3 shadow-xs backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/50">
              <div className="flex items-center gap-1.5 text-amber-500 mb-0.5">
                <StarIcon size={13} filled />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Favorites</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                {stats.favoritesCount || 0}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white/70 p-2.5 sm:p-3 shadow-xs backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/50">
              <div className="flex items-center gap-1.5 text-brand-500 mb-0.5">
                <BookOpenIcon size={13} />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Reading</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                {stats.inProgressCount || 0}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white/70 p-2.5 sm:p-3 shadow-xs backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/50">
              <div className="flex items-center gap-1.5 text-emerald-500 mb-0.5">
                <CheckIcon size={13} />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Completed</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                {stats.completedCount || 0}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white/70 p-2.5 sm:p-3 shadow-xs backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/50">
              <div className="flex items-center gap-1.5 text-indigo-500 mb-0.5">
                <UsersIcon size={13} />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Groups</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                {groups.length || stats.groupsCount || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/80 mb-3.5 sm:mb-5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("favorites")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "favorites"
                ? "bg-white text-amber-600 shadow-xs dark:bg-slate-800 dark:text-amber-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <StarIcon size={13} filled={activeTab === "favorites"} />
            <span>Favorites ({favorites.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("in-progress")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "in-progress"
                ? "bg-white text-brand-600 shadow-xs dark:bg-slate-800 dark:text-brand-300"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <BookOpenIcon size={13} />
            <span>In Progress ({inProgress.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("groups")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "groups"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-indigo-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <UsersIcon size={13} />
            <span>My Groups ({groups.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : activeTab === "favorites" ? (
          favorites.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
              {favorites.map((book: any) => (
                <ProfileFavoriteCard
                  key={book.id}
                  book={book}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border border-dashed border-slate-200 bg-white/50 p-8 sm:p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <StarIcon size={32} className="text-slate-300 dark:text-slate-600 mb-2.5" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                No Favorite Books Yet
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Star books in your library or book details to quickly access them in your favorites list.
              </p>
              <Link
                href="/library"
                className="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-xs font-bold text-white shadow-xs shadow-brand-500/20 hover:bg-brand-500 transition-all"
              >
                Explore Library
              </Link>
            </div>
          )
        ) : activeTab === "in-progress" ? (
          inProgress.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {inProgress.map((prog: any) => (
                <ProfileProgressCard key={prog.id} prog={prog} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border border-dashed border-slate-200 bg-white/50 p-8 sm:p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <BookOpenIcon size={32} className="text-slate-300 dark:text-slate-600 mb-2.5" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                No Active Reading Progress
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Open any book in your library to automatically track your reading progress here.
              </p>
              <Link
                href="/library"
                className="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-xs font-bold text-white shadow-xs shadow-brand-500/20 hover:bg-brand-500 transition-all"
              >
                Start Reading
              </Link>
            </div>
          )
        ) : (
          groups.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {groups.map((group: any) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border border-dashed border-slate-200 bg-white/50 p-8 sm:p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <UsersIcon size={32} className="text-slate-300 dark:text-slate-600 mb-2.5" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Not in Any Groups Yet
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Create a reading group or join one with an invite code to share books and read together.
              </p>
              <Link
                href="/groups"
                className="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-xs font-bold text-white shadow-xs shadow-brand-500/20 hover:bg-brand-500 transition-all"
              >
                Explore Groups
              </Link>
            </div>
          )
        )}
      </main>
    </div>
  );
}

function ProfileFavoriteCard({
  book,
  onToggleFavorite,
}: {
  book: any;
  onToggleFavorite: (id: string, current: boolean) => void;
}) {
  const [failed, setFailed] = useState(false);
  const bookId = book.driveFileId || book.id;
  const src = book.coverUrl || book.cover || `/api/books/${bookId}/thumb`;
  const readUrl = `/read/${bookId}?from=${encodeURIComponent("/profile")}`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-brand-500/10 dark:border-slate-800/80 dark:bg-slate-900/80">
      {/* Cover */}
      <Link
        href={readUrl}
        className="relative block aspect-[3/4] w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
      >
        {!failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={book.title}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center">
            <BookOpenIcon size={24} className="text-slate-300 dark:text-slate-600 mb-1.5" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 line-clamp-2">
              {book.title}
            </span>
          </div>
        )}

        {/* Favorite Icon Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(book.id, true);
          }}
          title="Remove from favorites"
          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/90 dark:bg-slate-900/90 text-amber-500 shadow-xs hover:scale-110 transition-transform z-10"
        >
          <StarIcon size={12} filled />
        </button>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="px-2.5 py-1 rounded-full bg-white text-slate-900 text-[10px] sm:text-xs font-extrabold shadow-sm">
            Read
          </span>
        </div>
      </Link>

      {/* Details */}
      <div className="p-2 sm:p-2.5 flex flex-col flex-1 justify-between">
        <div>
          <Link
            href={`/book/${bookId}`}
            className="block text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 hover:text-brand-600 transition-colors"
          >
            {book.title}
          </Link>
          <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
            {book.author || "Unknown Author"}
          </p>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9px] sm:text-[10px] text-slate-400">
          <span>{book.pageCount ? `${book.pageCount} pgs` : "PDF"}</span>
          <Link href={readUrl} className="font-bold text-brand-600 hover:underline">
            Read →
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProfileProgressCard({ prog }: { prog: any }) {
  const [failed, setFailed] = useState(false);
  const book = prog.book;
  if (!book) return null;

  const totalPages = book.pageCount || 1;
  const pct = Math.min(100, Math.round((prog.currentPage / totalPages) * 100));
  const bookId = book.driveFileId || book.id;
  const src = book.coverUrl || book.cover || `/api/books/${bookId}/thumb`;
  const readUrl = `/read/${bookId}?from=${encodeURIComponent("/profile")}`;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80">
      <Link
        href={readUrl}
        className="h-14 w-10 sm:h-16 sm:w-11 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 shadow-xs relative block group"
      >
        {!failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-400">
            <BookOpenIcon size={14} />
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={readUrl} className="hover:text-brand-600 transition-colors">
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
            {book.title}
          </h4>
        </Link>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
          Page {prog.currentPage} of {book.pageCount || "—"} ({pct}%)
        </p>

        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-1.5 flex items-center justify-end">
          <Link
            href={readUrl}
            className="text-[11px] font-bold text-brand-600 hover:underline"
          >
            Continue Reading →
          </Link>
        </div>
      </div>
    </div>
  );
}
