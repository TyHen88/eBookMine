"use client";

import React, { useState } from "react";
import { XIcon, UsersIcon, CrownIcon, TrashIcon, LogOutIcon } from "../ui/icons";

interface GroupMembersModalProps {
  isOpen: boolean;
  groupId: string;
  groupName: string;
  members: any[];
  ownerId: string;
  currentUserId?: string;
  isOwner: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function GroupMembersModal({
  isOpen,
  groupId,
  groupName,
  members,
  ownerId,
  currentUserId,
  isOwner,
  onClose,
  onRefresh,
}: GroupMembersModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleKickMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member from the group?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members?userId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member");
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm("Are you sure you want to leave this group?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}?action=leave`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to leave group");
      window.location.href = "/groups";
    } catch (err: any) {
      setError(err.message || "Failed to leave group");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
              <UsersIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Group Members ({members.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {groupName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {members.map((m: any) => {
              const u = m.user;
              if (!u) return null;
              const isGroupOwner = m.role === "OWNER" || u.id === ownerId;
              const isSelf = u.id === currentUserId;

              return (
                <div
                  key={m.id || u.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    {u.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.image}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-brand-500/30"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {u.name || u.email?.split("@")[0] || "User"}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] text-slate-400 font-semibold">(You)</span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide uppercase ${
                            isGroupOwner
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {isGroupOwner && <CrownIcon size={10} className="text-amber-500" />}
                          {isGroupOwner ? "Owner" : "Member"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    {isOwner && !isGroupOwner && (
                      <button
                        onClick={() => handleKickMember(u.id)}
                        disabled={loading}
                        title="Remove member"
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            {!isOwner && (
              <button
                onClick={handleLeaveGroup}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
              >
                <LogOutIcon size={14} />
                <span>Leave Group</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
