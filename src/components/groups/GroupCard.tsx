"use client";

import React from "react";
import Link from "next/link";
import { UsersIcon, FolderIcon, BookOpenIcon, LockIcon, CrownIcon } from "../ui/icons";

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    description?: string | null;
    privacy: "PUBLIC" | "PRIVATE" | "SECRET";
    code: string;
    myRole?: string;
    owner?: { name?: string | null; email?: string | null; image?: string | null };
    members?: Array<{ user?: { id: string; name?: string | null; image?: string | null } }>;
    folders?: Array<{ id: string; name: string }>;
    books?: Array<{ book?: { id: string; title: string; coverUrl?: string | null } }>;
    _count?: { members: number; books: number; folders: number };
  };
  onJoin?: (groupId: string) => void;
  isDiscover?: boolean;
}

export default function GroupCard({ group, onJoin, isDiscover = false }: GroupCardProps) {
  const memberCount = group._count?.members || group.members?.length || 1;
  const bookCount = group._count?.books || group.books?.length || 0;
  const folderCount = group._count?.folders || group.folders?.length || 1;

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10 dark:border-slate-800/80 dark:bg-slate-900/90">
      {/* Top Banner Accent */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-600 via-indigo-500 to-purple-500 opacity-80 group-hover:opacity-100 transition-opacity" />

      <div>
        {/* Header & Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
              group.privacy === "PUBLIC"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
            }`}
          >
            {group.privacy === "PUBLIC" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Public
              </>
            ) : (
              <>
                <LockIcon size={10} />
                Private
              </>
            )}
          </span>

          {group.myRole && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200/60 dark:border-brand-900/60">
              {group.myRole === "OWNER" && <CrownIcon size={10} className="text-amber-500" />}
              {group.myRole}
            </span>
          )}
        </div>

        {/* Group Title & Description */}
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1">
          {group.name}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">
          {group.description || "Reading group with shared books and folders."}
        </p>

        {/* Folders & Books Stats Pill */}
        <div className="mt-4 flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <FolderIcon size={14} className="text-brand-500" />
            <span>{folderCount} {folderCount === 1 ? "Folder" : "Folders"}</span>
          </div>
          <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <BookOpenIcon size={14} className="text-indigo-500" />
            <span>{bookCount} {bookCount === 1 ? "Book" : "Books"}</span>
          </div>
        </div>
      </div>

      {/* Footer Area */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
        {/* Members Avatars */}
        <div className="flex items-center gap-1.5">
          <UsersIcon size={14} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {memberCount} {memberCount === 1 ? "Member" : "Members"}
          </span>
        </div>

        {/* Action Button */}
        {isDiscover ? (
          <button
            onClick={() => onJoin && onJoin(group.id)}
            className="px-4 py-1.5 rounded-full bg-brand-50 hover:bg-brand-100 text-xs font-bold text-brand-600 transition-all dark:bg-brand-950/60 dark:hover:bg-brand-900/80 dark:text-brand-300 active:scale-95"
          >
            Join Group
          </button>
        ) : (
          <Link
            href={`/groups/${group.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 text-xs font-bold text-white shadow-sm shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <span>Open Library</span>
          </Link>
        )}
      </div>
    </div>
  );
}
