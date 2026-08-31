"use client";

import React, { useState } from "react";
import { XIcon, FolderPlusIcon } from "../ui/icons";

interface CreateFolderModalProps {
  isOpen: boolean;
  groupId: string;
  onClose: () => void;
  onSuccess: (newFolder: any) => void;
}

const FOLDER_COLORS = [
  { id: "blue", name: "Ocean Blue", bg: "bg-blue-500", border: "border-blue-400" },
  { id: "emerald", name: "Emerald", bg: "bg-emerald-500", border: "border-emerald-400" },
  { id: "purple", name: "Violet", bg: "bg-purple-500", border: "border-purple-400" },
  { id: "amber", name: "Amber", bg: "bg-amber-500", border: "border-amber-400" },
  { id: "rose", name: "Rose", bg: "bg-rose-500", border: "border-rose-400" },
  { id: "indigo", name: "Indigo", bg: "bg-indigo-500", border: "border-indigo-400" },
];

export default function CreateFolderModal({
  isOpen,
  groupId,
  onClose,
  onSuccess,
}: CreateFolderModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a folder name");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_FOLDER",
          name: name.trim(),
          description: description.trim(),
          color,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create folder");

      onSuccess(data.folder);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create folder");
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
              <FolderPlusIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                New Group Folder
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create a folder to categorize shared books
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Folder Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Chapter 1 Readings, AI Papers, Novels..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="Brief note about this folder..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Color Tag
            </label>
            <div className="flex items-center gap-2.5">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  title={c.name}
                  className={`h-8 w-8 rounded-full ${c.bg} transition-all duration-200 ${
                    color === c.id
                      ? "ring-4 ring-brand-500/30 scale-110 shadow-md"
                      : "opacity-70 hover:opacity-100 hover:scale-105"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
