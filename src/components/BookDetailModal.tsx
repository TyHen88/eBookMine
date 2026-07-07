"use client";

import { useEffect, useState } from "react";
import { BookMeta } from "@/lib/types";
import { CATEGORIES } from "@/lib/categorize";
import { Button, IconButton, Input, Select } from "./ui";
import { TrashIcon, XIcon } from "./ui/icons";

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white p-6 shadow-2xl shadow-brand-500/10 ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600" />

        <div className="mb-5 flex items-start gap-4">
          {book.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover}
              alt=""
              className="h-28 w-20 rounded-lg object-cover shadow-md"
            />
          ) : (
            <div className="flex h-28 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-brand-100 to-brand-300 text-xs text-brand-800 dark:from-brand-900 dark:to-brand-700 dark:text-brand-100">
              No cover
            </div>
          )}
          <div className="space-y-0.5 text-sm text-slate-500 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              Edit details
            </p>
            <p>{book.pageCount || "?"} pages</p>
            <p>{(book.sizeBytes / 1048576).toFixed(1)} MB</p>
            <p>Added {new Date(book.addedAt).toLocaleDateString()}</p>
            {book.lastPage > 1 && <p>On page {book.lastPage}</p>}
          </div>
          <IconButton
            onClick={onClose}
            aria-label="Close"
            size="icon-sm"
            className="ml-auto -mr-1 -mt-1 text-slate-400 hover:rotate-90"
          >
            <XIcon size={18} />
          </IconButton>
        </div>

        <div className="space-y-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Author">
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
          <Field label="Category">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tags (comma-separated)">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="fiction, sci-fi, to-read"
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 transition-colors hover:text-red-500"
            >
              <TrashIcon size={16} />
              Delete
            </button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                setDeleting(true);
                await onDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </Button>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}
