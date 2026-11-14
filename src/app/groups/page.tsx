"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import GroupCard from "@/components/groups/GroupCard";
import CreateGroupModal from "@/components/groups/CreateGroupModal";
import JoinGroupModal from "@/components/groups/JoinGroupModal";
import {
  UsersIcon,
  PlusIcon,
  UserPlusIcon,
  SearchIcon,
  BookOpenIcon,
  SparklesIcon,
} from "@/components/ui/icons";

export default function GroupsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"my-groups" | "discover">("my-groups");
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [publicGroups, setPublicGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/groups");
      if (res.ok) {
        const data = await res.json();
        setMyGroups(data.myGroups || []);
        setPublicGroups(data.publicGroups || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [status]);

  const handleJoinPublic = async (groupId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "JOIN" }),
      });
      if (res.ok) {
        router.push(`/groups/${groupId}`);
      }
    } catch {
      // ignore
    }
  };

  const filteredMyGroups = myGroups.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPublicGroups = publicGroups.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Header />

      <main className="mx-auto w-full max-w-[1380px] flex-1 space-y-5 px-4 sm:px-6 pt-4 sm:pt-6 pb-28 md:pb-14 md:pl-24 md:pr-10 animate-fade-in">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-600 via-indigo-600 to-slate-900 p-5 sm:p-6 text-white shadow-xl shadow-brand-600/15 dark:border-brand-500/25">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
                  <UsersIcon size={12} className="text-emerald-300" />
                  <span>Collaborative Study Spaces</span>
                </span>
                <span className="rounded-full bg-slate-950/30 px-2.5 py-1 text-[11px] font-bold text-brand-100 ring-1 ring-white/15">
                  {myGroups.length} My Groups • {publicGroups.length} Public
                </span>
              </div>
              <h1 className="font-black tracking-tight text-white [font-size:clamp(1.35rem,1.05rem+1.2vw,2rem)] leading-tight">
                Reading Groups & Shared Folders
              </h1>
              <p className="text-xs sm:text-sm text-brand-100/90 max-w-2xl">
                Create reading groups with friends, organize books into themed folders, and collaborate on study collections.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsJoinOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs sm:text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
              >
                <UserPlusIcon size={15} />
                <span>Join with Code</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs sm:text-sm font-bold text-brand-700 shadow-md transition-all hover:bg-brand-50 hover:-translate-y-0.5 active:scale-95"
              >
                <PlusIcon size={15} />
                <span>Create Group</span>
              </button>
            </div>
          </div>
        </section>

        {/* Navigation Tabs & Search Command Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-xs backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 self-start">
            <button
              type="button"
              onClick={() => setActiveTab("my-groups")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "my-groups"
                  ? "bg-white text-brand-600 shadow-xs dark:bg-slate-900 dark:text-brand-300"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <UsersIcon size={13} />
              <span>My Groups ({myGroups.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("discover")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "discover"
                  ? "bg-white text-brand-600 shadow-xs dark:bg-slate-900 dark:text-brand-300"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <BookOpenIcon size={13} />
              <span>Discover Public ({publicGroups.length})</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search groups by name or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pl-9 pr-3 py-2 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon size={14} />
            </span>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-52 rounded-3xl border border-slate-200/60 bg-white/50 p-5 dark:border-slate-800/60 dark:bg-slate-900/50 animate-pulse"
              />
            ))}
          </div>
        ) : activeTab === "my-groups" ? (
          filteredMyGroups.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMyGroups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50 p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 mb-4">
                <UsersIcon size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {status === "unauthenticated" ? "Sign in to Access Reading Groups" : "No Reading Groups Yet"}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                {status === "unauthenticated"
                  ? "Please sign in with your account to create reading groups, organize folders, and read books with friends."
                  : "Create your first reading group or join one with an invite code to share and read books with friends."}
              </p>
              <div className="mt-6 flex items-center gap-3">
                {status === "unauthenticated" ? (
                  <Link
                    href="/login"
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 text-xs font-bold text-white shadow-md shadow-brand-500/20 hover:scale-105 transition-all"
                  >
                    Sign In Now
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={() => setIsJoinOpen(true)}
                      className="px-4 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Join with Code
                    </button>
                    <button
                      onClick={() => setIsCreateOpen(true)}
                      className="px-5 py-2 rounded-2xl bg-brand-600 text-xs font-bold text-white shadow-md shadow-brand-500/20 hover:bg-brand-500"
                    >
                      Create Group
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        ) : (
          filteredPublicGroups.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPublicGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isDiscover={true}
                  onJoin={handleJoinPublic}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50 p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <BookOpenIcon size={32} className="text-slate-400 mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                No Public Groups Discovered
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Be the first to create a public reading group!
              </p>
            </div>
          )
        )}
      </main>

      {/* Modals */}
      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(group) => {
          fetchGroups();
          router.push(`/groups/${group.id}`);
        }}
      />

      <JoinGroupModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        onSuccess={(groupId) => {
          fetchGroups();
          router.push(`/groups/${groupId}`);
        }}
      />
    </div>
  );
}
