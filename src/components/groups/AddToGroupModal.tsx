"use client";

import React, { useState, useEffect } from "react";
import { XIcon, UsersIcon, FolderIcon, CheckIcon, PlusIcon } from "../ui/icons";

interface AddToGroupModalProps {
  isOpen: boolean;
  bookId: string;
  bookTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddToGroupModal({
  isOpen,
  bookId,
  bookTitle,
  onClose,
  onSuccess,
}: AddToGroupModalProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Fetch user groups
  useEffect(() => {
    if (!isOpen) return;
    setLoadingGroups(true);
    setError(null);
    setSuccessMessage(null);
    fetch("/api/groups")
      .then((r) => (r.ok ? r.json() : { myGroups: [] }))
      .then((d) => {
        const my = d.myGroups || [];
        setGroups(my);
        if (my.length > 0) {
          setSelectedGroupId(my[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingGroups(false));
  }, [isOpen]);

  // 2. Fetch folders when selected group changes
  useEffect(() => {
    if (!selectedGroupId) {
      setFolders([]);
      setSelectedFolderId("");
      return;
    }
    setLoadingFolders(true);
    fetch(`/api/groups/${selectedGroupId}/folders`)
      .then((r) => (r.ok ? r.json() : { folders: [] }))
      .then((d) => {
        const f = d.folders || [];
        setFolders(f);
        setSelectedFolderId(f[0]?.id || "");
      })
      .catch(() => {})
      .finally(() => setLoadingFolders(false));
  }, [selectedGroupId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) {
      setError("Please select a group");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_BOOK",
          bookId,
          groupFolderId: selectedFolderId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add book to group");

      setSuccessMessage("Book added to group successfully!");
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to add book");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
              <UsersIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Add to Reading Group
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                {bookTitle}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center gap-2">
              <CheckIcon size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {loadingGroups ? (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
              Loading your reading groups...
            </div>
          ) : groups.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              You haven&apos;t joined or created any reading groups yet.
            </div>
          ) : (
            <>
              {/* Group Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 outline-none transition-all focus:border-brand-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      👥 {g.name} ({g.privacy === "PUBLIC" ? "Public" : "Private"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Folder Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Group Folder (Optional)
                </label>
                {loadingFolders ? (
                  <div className="py-2 text-xs text-slate-400 animate-pulse">
                    Loading folders...
                  </div>
                ) : folders.length > 0 ? (
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 outline-none transition-all focus:border-brand-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">📁 Main (No specific folder)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800">
                    No folders created in this group yet (Book will be placed in Main).
                  </div>
                )}
              </div>
            </>
          )}

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || groups.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add to Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
