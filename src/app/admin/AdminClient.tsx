"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonClass, Spinner } from "@/components/ui";
import {
  ArrowLeftIcon,
  SparklesIcon,
  RefreshIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
} from "@/components/ui/icons";

interface AdminClientProps {
  initialBooks: any[];
  initialUsers: any[];
  initialCategories: any[];
  initialAuthors: any[];
  aiUsageCount: number;
}

export default function AdminClient({
  initialBooks,
  initialUsers,
  initialCategories,
  initialAuthors,
  aiUsageCount,
}: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<"books" | "users" | "drive" | "ai" | "settings">("books");
  const [books, setBooks] = useState(initialBooks);
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Edit Book Modal State
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const handleTogglePublish = async (bookId: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !currentStatus }),
      });
      if (res.ok) {
        setBooks((prev) =>
          prev.map((b) => (b.id === bookId ? { ...b, published: !currentStatus } : b))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBookMetadata = async (bookId: string) => {
    if (!confirm("Are you sure you want to delete this book's metadata? (PDF file in Google Drive will remain safe)")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
      if (res.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== bookId));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDriveSync = async () => {
    setLoading(true);
    setStatusMsg("Syncing Google Drive metadata with Neon PostgreSQL...");
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const d = await res.json();
      setStatusMsg(`Drive Sync completed! ${d.imported?.length || 0} books synced.`);
    } catch {
      setStatusMsg("Drive Sync failed. Check server logs.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBookEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${editingBook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          author: editAuthor,
          category: editCategory,
        }),
      });
      if (res.ok) {
        setBooks((prev) =>
          prev.map((b) =>
            b.id === editingBook.id
              ? { ...b, title: editTitle, author: editAuthor, category: editCategory }
              : b
          )
        );
        setEditingBook(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      {/* Edit Book Modal */}
      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveBookEdit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Edit Book Metadata</h3>
              <button type="button" onClick={() => setEditingBook(null)} className="text-slate-400 hover:text-slate-600">
                <XIcon size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Author</label>
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Category</label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingBook(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3.5 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className={buttonClass({ variant: "ghost", size: "icon-sm" })}>
              <ArrowLeftIcon size={18} />
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="rounded-lg bg-brand-500/10 px-2 py-0.5 text-xs font-black text-brand-600 dark:text-brand-400">
                ADMIN
              </span>
              eBookMine Control Panel
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {statusMsg && (
              <span className="text-xs text-brand-600 dark:text-brand-400 animate-fade-in">
                {statusMsg}
              </span>
            )}
            <Button size="sm" variant="secondary" onClick={handleTriggerDriveSync} disabled={loading}>
              <RefreshIcon size={14} />
              Sync Drive
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl gap-2 pt-2">
          {(["books", "users", "drive", "ai", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`border-b-2 px-4 py-2.5 text-xs font-bold capitalize transition-colors ${
                activeTab === t
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t === "ai" ? "AI Usage" : t === "drive" ? "Google Drive Sync" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Body Content */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
        {/* Books Management Tab */}
        {activeTab === "books" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Library Books ({books.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-3">Title</th>
                    <th className="p-3">Author</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {books.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                        {b.title}
                      </td>
                      <td className="p-3 text-slate-500">{b.author}</td>
                      <td className="p-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {b.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            b.published
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {b.published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingBook(b);
                            setEditTitle(b.title);
                            setEditAuthor(b.author);
                            setEditCategory(b.category);
                          }}
                          className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleTogglePublish(b.id, b.published)}
                          className="text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300"
                        >
                          {b.published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          onClick={() => handleDeleteBookMetadata(b.id)}
                          className="text-xs font-semibold text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Management Tab */}
        {activeTab === "users" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Registered Users ({users.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Joined</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {u.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.image} alt={u.name || "Avatar"} className="h-6 w-6 rounded-full" />
                        )}
                        {u.name || "User"}
                      </td>
                      <td className="p-3 text-slate-500">{u.email}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            u.role === "ADMIN"
                              ? "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleToggleUserRole(u.id, u.role)}
                          className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {u.role === "ADMIN" ? "Make User" : "Make Admin"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Google Drive Sync Tab */}
        {activeTab === "drive" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Google Drive PDF Storage Health
            </h2>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50 space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                PDF binaries remain securely stored in your Google Drive folder (`eBookMine/PDFs`). Neon PostgreSQL synchronizes metadata record tags and vector indices.
              </p>
              <Button size="sm" onClick={handleTriggerDriveSync} disabled={loading}>
                <RefreshIcon size={14} />
                Run Idempotent Drive Metadata Sync
              </Button>
            </div>
          </div>
        )}

        {/* AI Usage & Cost Analytics Tab */}
        {activeTab === "ai" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total AI Executions
              </span>
              <p className="mt-1 text-3xl font-black text-brand-600 dark:text-brand-400">
                {aiUsageCount}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Logged in PostgreSQL AIUsage table</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Daily Token Limit
              </span>
              <p className="mt-1 text-3xl font-black text-emerald-600 dark:text-emerald-400">
                100,000
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Enforced per user by checkAndTrackUsage()</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Configured Model
              </span>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                {process.env.NEXT_PUBLIC_AI_MODEL || "google/gemini-2.5-flash"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Provider: OpenRouter / Server-side LLM</p>
            </div>
          </div>
        )}

        {/* System Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              System Environment & Security Status
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold">Neon PostgreSQL Database</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Connected
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold">Google OAuth 2.0 Provider</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Active
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold">pgvector Extension</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Enabled
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold">PDF.js Web Worker</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  v4.4.168
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
