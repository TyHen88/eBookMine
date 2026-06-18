"use client";

import { useState } from "react";
import { BookMeta } from "@/lib/types";
import { CATEGORIES } from "@/lib/categorize";

export default function BookDetailModal({
  book,
  onClose,
  onSave,
  onDelete,
}: {
  book: BookMeta;
  onClose: () => void;
  onSave: (patch: Partial<BookMeta>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [category, setCategory] = useState(book.category || "Other");
  const [tags, setTags] = useState(book.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave({
      title: title.trim() || book.title,
      author: author.trim() || "Unknown",
      category: category.trim() || "Other",
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-4">
          {book.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.cover} alt="" className="h-28 w-20 rounded-md object-cover" />
          ) : (
            <div className="flex h-28 w-20 items-center justify-center rounded-md bg-brand-100 text-xs dark:bg-brand-900">
              No cover
            </div>
          )}
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <p>{book.pageCount || "?"} pages</p>
            <p>{(book.sizeBytes / 1048576).toFixed(1)} MB</p>
            <p>Added {new Date(book.addedAt).toLocaleDateString()}</p>
            {book.lastPage > 1 && <p>On page {book.lastPage}</p>}
          </div>
        </div>

        <label className="block text-sm font-medium">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-3 mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
        />

        <label className="block text-sm font-medium">Author</label>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="mb-3 mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
        />

        <label className="block text-sm font-medium">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mb-3 mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium">Tags (comma-separated)</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="fiction, sci-fi, to-read"
          className="mb-4 mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
        />

        <div className="flex items-center justify-between">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Delete
            </button>
          ) : (
            <button
              onClick={async () => {
                setDeleting(true);
                await onDelete();
              }}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
