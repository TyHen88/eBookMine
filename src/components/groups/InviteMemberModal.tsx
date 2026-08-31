"use client";

import React, { useState } from "react";
import { XIcon, CopyIcon, CheckIcon, UserPlusIcon } from "../ui/icons";

interface InviteMemberModalProps {
  isOpen: boolean;
  groupId: string;
  groupName: string;
  inviteCode: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function InviteMemberModal({
  isOpen,
  groupId,
  groupName,
  inviteCode,
  onClose,
  onSuccess,
}: InviteMemberModalProps) {
  const [copied, setCopied] = useState(false);
  const [emailOrId, setEmailOrId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrId.trim()) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailOrId.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add member");

      setMessage(data.message || "Member added successfully!");
      setEmailOrId("");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to invite user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
              <UserPlusIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Invite Members
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Invite friends to {groupName}
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* 1. Share Invite Code */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Group 6-Character Invite Code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-mono font-black tracking-widest text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
                {inviteCode}
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-brand-50 border border-brand-200 text-xs font-bold text-brand-600 transition-all hover:bg-brand-100 dark:bg-brand-950/60 dark:border-brand-800 dark:text-brand-300 active:scale-95"
              >
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Friends can click &quot;Join with Code&quot; and enter this code to instantly see all books.
            </p>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              or invite directly
            </span>
          </div>

          {/* 2. Direct Add by Email */}
          <form onSubmit={handleDirectInvite} className="space-y-3">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-400">
                {message}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                User Email or Username
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="friend@example.com"
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
                />
                <button
                  type="submit"
                  disabled={loading || !emailOrId.trim()}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 text-xs font-bold text-white shadow-md shadow-brand-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </form>

          <div className="pt-2 flex items-center justify-end border-t border-slate-100 dark:border-slate-800/80">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
