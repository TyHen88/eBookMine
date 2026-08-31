"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import VerticalNav from "@/components/VerticalNav";
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <Header />
      <VerticalNav />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 md:pl-24">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-brand-50/20 to-indigo-50/30 p-6 sm:p-8 shadow-xl shadow-brand-500/5 backdrop-blur-xl dark:border-slate-800/80 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-indigo-950/20 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200/60 dark:border-brand-900/60 mb-3">
                <UsersIcon size={14} className="text-brand-500" />
                <span>Collaborative Reading</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Reading Groups & Folders
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-xl">
                Create groups with friends, organize books into shared folders, and read your favorite eBooks together.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsJoinOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm transition-all hover:scale-105 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <UserPlusIcon size={16} />
                <span>Join with Code</span>
              </button>

              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 text-xs font-bold text-white shadow-md shadow-brand-500/25 transition-all hover:scale-105 active:scale-95"
              >
                <PlusIcon size={16} />
                <span>Create Group</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/80 self-start">
            <button
              onClick={() => setActiveTab("my-groups")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "my-groups"
                  ? "bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <UsersIcon size={15} />
              <span>My Groups ({myGroups.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("discover")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "discover"
                  ? "bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <BookOpenIcon size={15} />
              <span>Discover Public ({publicGroups.length})</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200/80 bg-white/80 pl-9 pr-4 py-2 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
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
