"use client";

import React, { useState, useEffect } from "react";
import { XIcon, BookOpenIcon, SearchIcon, CheckIcon } from "../ui/icons";

interface AddBookToGroupModalProps {
  isOpen: boolean;
  groupId: string;
  folders: Array<{ id: string; name: string; color?: string | null }>;
  defaultFolderId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const FOLDER_COLOR_EMOJI: Record<string, string> = {
  blue: "🔵",
  emerald: "🟢",
  purple: "🟣",
  amber: "🟡",
  rose: "🔴",
  indigo: "🟣",
};

export default function AddBookToGroupModal({
  isOpen,
  groupId,
  folders,
  defaultFolderId,
  onClose,
  onSuccess,
}: AddBookToGroupModalProps) {
  const [books, setBooks] = useState<any[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(defaultFolderId || folders[0]?.id || "");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultFolderId) setSelectedFolderId(defaultFolderId);
    else if (folders.length > 0 && !selectedFolderId) setSelectedFolderId(folders[0].id);
  }, [defaultFolderId, folders]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/books")
      .then((r) => (r.ok ? r.json() : { books: [] }))
      .then((d) => setBooks(d.books || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredBooks = books.filter((b) =>
    b.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookId) {
      setError("Please select a book to add");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_BOOK",
          bookId: selectedBookId,
          groupFolderId: selectedFolderId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add book to group");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add book");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
              <BookOpenIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Add Book to Group
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Share a book from your library with group members
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Folder Selector */}
          {folders.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Destination Folder
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 outline-none transition-all focus:border-brand-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {FOLDER_COLOR_EMOJI[f.color || "blue"] || "📁"} {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Books */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Choose a Book from Your Library
            </label>
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search your books..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-900"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon size={14} />
              </span>
            </div>

            {/* Books List Grid */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                  Loading library books...
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No books found in library.
                </div>
              ) : (
                filteredBooks.map((book) => {
                  const isSelected = selectedBookId === book.id;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => setSelectedBookId(book.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20 dark:bg-brand-950/40 dark:border-brand-500"
                          : "border-slate-100 bg-slate-50/30 hover:border-slate-200 dark:border-slate-800/60 dark:bg-slate-800/30 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <ModalBookThumb book={book} />
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {book.title}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {book.authors?.map((a: any) => a.author?.name || a.name).join(", ") || "Unknown Author"}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-brand-600 text-white shadow-sm"
                            : "border border-slate-200 dark:border-slate-700 text-transparent"
                        }`}
                      >
                        <CheckIcon size={13} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

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
              disabled={submitting || !selectedBookId}
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

function ModalBookThumb({ book }: { book: any }) {
  const [failed, setFailed] = useState(false);
  const src = book.coverUrl || `/api/books/${book.id}/thumb`;

  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="h-11 w-8 rounded-lg object-cover shadow-sm flex-shrink-0 bg-slate-100 dark:bg-slate-800"
      />
    );
  }

  return (
    <div className="h-11 w-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
      <BookOpenIcon size={14} />
    </div>
  );
}
