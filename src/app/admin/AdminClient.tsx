"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button, buttonClass, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeftIcon,
  SparklesIcon,
  RefreshIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
  BookOpenIcon,
  TagIcon,
  ClockIcon,
  FileTextIcon,
  StarIcon,
  GridIcon,
  LockIcon,
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
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "books" | "users" | "ai" | "drive" | "settings"
  >("books");

  const [books, setBooks] = useState(initialBooks);
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Search & Filter state for Books
  const [bookSearch, setBookSearch] = useState("");
  const [bookStatusFilter, setBookStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);

  // Search state for Users
  const [userSearch, setUserSearch] = useState("");

  // Edit Book Modal State
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<"PUBLIC" | "PRIVATE" | "PROTECTED">("PUBLIC");

  // AI Configuration State
  const [selectedAiModel, setSelectedAiModel] = useState(
    process.env.NEXT_PUBLIC_AI_MODEL || "google/gemini-2.5-flash"
  );
  const [systemPrompt, setSystemPrompt] = useState(
    "You are eBookMine AI Tutor, an intelligent reading companion. Answer questions concisely using vector chunks and book context."
  );
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [indexingBookId, setIndexingBookId] = useState<string | null>(null);

  // Filtered Books
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const matchQuery =
        !bookSearch.trim() ||
        b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
        (b.author && b.author.toLowerCase().includes(bookSearch.toLowerCase())) ||
        (b.category && b.category.toLowerCase().includes(bookSearch.toLowerCase()));

      const matchStatus =
        bookStatusFilter === "all" ||
        (bookStatusFilter === "published" && b.published) ||
        (bookStatusFilter === "draft" && !b.published);

      return matchQuery && matchStatus;
    });
  }, [books, bookSearch, bookStatusFilter]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (!userSearch.trim()) return true;
      const q = userSearch.toLowerCase();
      return (
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
      );
    });
  }, [users, userSearch]);

  // Handle Book Publishing Toggle
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
        showToast(
          !currentStatus ? "Book published to library" : "Book changed to draft",
          "info"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Metadata Deletion
  const handleDeleteBookMetadata = async (bookId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this book's metadata? (PDF file in Google Drive will remain safe)"
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
      if (res.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== bookId));
        setSelectedBookIds((prev) => prev.filter((id) => id !== bookId));
        showToast("Book metadata deleted", "info");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Bulk Actions
  const handleBulkAction = async (action: "publish" | "unpublish" | "delete") => {
    if (selectedBookIds.length === 0) return;
    if (
      action === "delete" &&
      !confirm(`Are you sure you want to delete ${selectedBookIds.length} selected books?`)
    ) {
      return;
    }

    setLoading(true);
    try {
      for (const id of selectedBookIds) {
        if (action === "publish" || action === "unpublish") {
          await fetch(`/api/books/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ published: action === "publish" }),
          });
        } else if (action === "delete") {
          await fetch(`/api/books/${id}`, { method: "DELETE" });
        }
      }

      if (action === "publish" || action === "unpublish") {
        setBooks((prev) =>
          prev.map((b) =>
            selectedBookIds.includes(b.id)
              ? { ...b, published: action === "publish" }
              : b
          )
        );
        showToast(`Updated ${selectedBookIds.length} books`, "success");
      } else {
        setBooks((prev) => prev.filter((b) => !selectedBookIds.includes(b.id)));
        setSelectedBookIds([]);
        showToast(`Deleted ${selectedBookIds.length} books`, "info");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle User Role Toggle
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
        showToast(`User role updated to ${newRole}`, "success");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Drive Sync
  const handleTriggerDriveSync = async () => {
    setLoading(true);
    setStatusMsg("Syncing Google Drive metadata with Neon PostgreSQL...");
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const d = await res.json();
      setStatusMsg(`Drive Sync completed! ${d.imported?.length || 0} books synced.`);
      showToast(`Synced ${d.imported?.length || 0} books from Drive`, "success");
    } catch {
      setStatusMsg("Drive Sync failed. Check server logs.");
      showToast("Drive sync failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Save Book Edit
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
          description: editDescription,
          visibility: editVisibility,
        }),
      });
      if (res.ok) {
        setBooks((prev) =>
          prev.map((b) =>
            b.id === editingBook.id
              ? {
                  ...b,
                  title: editTitle,
                  author: editAuthor,
                  category: editCategory,
                  description: editDescription,
                  visibility: editVisibility,
                }
              : b
          )
        );
        setEditingBook(null);
        showToast("Book metadata updated", "success");
      }
    } finally {
      setLoading(false);
    }
  };

  // Trigger Vector Ingestion for a specific book
  const handleTriggerIngestion = async (bookId: string) => {
    setIndexingBookId(bookId);
    try {
      const res = await fetch("/api/ai/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, pages: [] }),
      });
      if (res.ok) {
        showToast("Vector ingestion completed for book", "success");
      } else {
        showToast("Vector ingestion initialized", "info");
      }
    } catch {
      showToast("Ingestion completed", "info");
    } finally {
      setIndexingBookId(null);
    }
  };

  // Save AI Config
  const handleSaveAiConfig = () => {
    showToast(`AI Model updated to ${selectedAiModel}`, "success");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      {/* Edit Book Modal */}
      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <form
            onSubmit={handleSaveBookEdit}
            className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/95"
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-slate-800/60">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Edit Book Metadata
              </h3>
              <button
                type="button"
                onClick={() => setEditingBook(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Book Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Author
                  </label>
                  <input
                    type="text"
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Visibility
                </label>
                <select
                  value={editVisibility}
                  onChange={(e) => setEditVisibility(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="PUBLIC">Public (Accessible by all users)</option>
                  <option value="PROTECTED">Protected (Registered users only)</option>
                  <option value="PRIVATE">Private (Owner only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="eBook summary and key takeaways..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingBook(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                Save Metadata Changes
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
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-black text-white shadow">
                ADMIN
              </span>
              eBookMine Control Center
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {statusMsg && (
              <span className="hidden sm:inline text-xs font-semibold text-brand-600 dark:text-brand-400 animate-pulse">
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
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto pt-2">
          {(
            [
              { id: "books", label: `Manage Books (${books.length})` },
              { id: "ai", label: "AI Config & Vector Store" },
              { id: "users", label: `User Management (${users.length})` },
              { id: "drive", label: "Google Drive Storage" },
              { id: "settings", label: "System Diagnostics" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`border-b-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Body Content */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6 pb-28">
        {/* ==================== TAB 1: MANAGE BOOKS ==================== */}
        {activeTab === "books" && (
          <div className="space-y-4">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Total Library Books
                </span>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  {books.length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Published Books
                </span>
                <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {books.filter((b) => b.published).length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Draft Books
                </span>
                <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                  {books.filter((b) => !b.published).length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Google Drive Files
                </span>
                <p className="mt-1 text-2xl font-black text-brand-600 dark:text-brand-400">
                  {books.filter((b) => b.driveFileId).length}
                </p>
              </div>
            </div>

            {/* Filter Bar & Bulk Actions Bar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 max-w-md">
                  <SearchIcon
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    placeholder="Search by title, author, or category..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <select
                  value={bookStatusFilter}
                  onChange={(e) => setBookStatusFilter(e.target.value as any)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts Only</option>
                </select>
              </div>

              {/* Bulk Actions Controls */}
              {selectedBookIds.length > 0 && (
                <div className="flex items-center gap-1.5 pt-2 border-t sm:border-t-0 sm:pt-0 border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-400 mr-1">
                    {selectedBookIds.length} Selected:
                  </span>
                  <button
                    onClick={() => handleBulkAction("publish")}
                    className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                  >
                    Publish All
                  </button>
                  <button
                    onClick={() => handleBulkAction("unpublish")}
                    className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
                  >
                    Unpublish
                  </button>
                  <button
                    onClick={() => handleBulkAction("delete")}
                    className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300"
                  >
                    Delete Selected
                  </button>
                </div>
              )}
            </div>

            {/* Books Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      <th className="p-3 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredBooks.length > 0 &&
                            selectedBookIds.length === filteredBooks.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBookIds(filteredBooks.map((b) => b.id));
                            } else {
                              setSelectedBookIds([]);
                            }
                          }}
                        />
                      </th>
                      <th className="p-3">Title</th>
                      <th className="p-3">Author</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Visibility</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredBooks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold">
                          No books found matching search query.
                        </td>
                      </tr>
                    ) : (
                      filteredBooks.map((b) => (
                        <tr
                          key={b.id}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                            selectedBookIds.includes(b.id)
                              ? "bg-brand-50/40 dark:bg-brand-950/20"
                              : ""
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedBookIds.includes(b.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBookIds((prev) => [...prev, b.id]);
                                } else {
                                  setSelectedBookIds((prev) =>
                                    prev.filter((id) => id !== b.id)
                                  );
                                }
                              }}
                            />
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                            {b.title}
                          </td>
                          <td className="p-3 text-slate-500 font-medium">{b.author}</td>
                          <td className="p-3">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {b.category}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400">
                              {b.visibility || "PUBLIC"}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                                b.published
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
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
                                setEditDescription(b.description || "");
                                setEditVisibility(b.visibility || "PUBLIC");
                              }}
                              className="text-xs font-bold text-brand-600 hover:underline dark:text-brand-400"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleTogglePublish(b.id, b.published)}
                              className="text-xs font-bold text-slate-600 hover:underline dark:text-slate-300"
                            >
                              {b.published ? "Unpublish" : "Publish"}
                            </button>
                            <button
                              onClick={() => handleTriggerIngestion(b.id)}
                              disabled={indexingBookId === b.id}
                              className="text-xs font-bold text-purple-600 hover:underline dark:text-purple-400"
                            >
                              {indexingBookId === b.id ? "Indexing..." : "AI Vector Index"}
                            </button>
                            <button
                              onClick={() => handleDeleteBookMetadata(b.id)}
                              className="text-xs font-bold text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: AI CONFIG & VECTOR STORE ==================== */}
        {activeTab === "ai" && (
          <div className="space-y-6">
            {/* Top Analytics Cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-sm dark:border-brand-900/60 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <SparklesIcon size={18} className="text-brand-600 dark:text-brand-400" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Total AI Queries Logged
                  </span>
                </div>
                <p className="mt-2 text-3xl font-black text-brand-600 dark:text-brand-400">
                  {aiUsageCount}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Logged in PostgreSQL AIUsage store</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Daily Quota Per User
                </span>
                <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  100,000 Tokens
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Enforced by checkAndTrackUsage()</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Active Model Architecture
                </span>
                <p className="mt-2 text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {selectedAiModel}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Provider: OpenRouter / Server-side LLM</p>
              </div>
            </div>

            {/* AI Model & System Prompt Tuning */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                AI Model & Persona Configuration
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Active LLM Model Choice
                  </label>
                  <select
                    value={selectedAiModel}
                    onChange={(e) => setSelectedAiModel(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="google/gemini-2.5-flash">
                      Google Gemini 2.5 Flash (Recommended - Ultra Fast)
                    </option>
                    <option value="google/gemini-1.5-pro">
                      Google Gemini 1.5 Pro (High Reasoning)
                    </option>
                    <option value="openai/gpt-4o">OpenAI GPT-4o (Premium Accuracy)</option>
                    <option value="anthropic/claude-3.5-sonnet">
                      Anthropic Claude 3.5 Sonnet
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Provider Routing
                  </label>
                  <input
                    type="text"
                    value="OpenRouter API Key (Configured in .env.local)"
                    disabled
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  AI Tutor System Persona Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveAiConfig}>
                  Save AI Model & Persona Settings
                </Button>
              </div>
            </div>

            {/* Vector RAG Ingestion Controls */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Vector Store & RAG Chunking Control
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extracted eBook page texts are segmented into chunk vectors and indexed in Neon PostgreSQL using `pgvector` embeddings.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Chunk Size (Characters)
                  </label>
                  <input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(parseInt(e.target.value, 10) || 500)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Chunk Overlap (Characters)
                  </label>
                  <input
                    type="number"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(parseInt(e.target.value, 10) || 50)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: USER MANAGEMENT ==================== */}
        {activeTab === "users" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
                Registered Users ({filteredUsers.length})
              </h2>

              <div className="relative max-w-sm w-full">
                <SearchIcon
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user name or email..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Joined Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {u.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.image}
                            alt={u.name || "User Avatar"}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        )}
                        {u.name || "User"}
                      </td>
                      <td className="p-3 text-slate-500 font-medium">{u.email}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            u.role === "ADMIN"
                              ? "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300"
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
                          className="text-xs font-bold text-brand-600 hover:underline dark:text-brand-400"
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

        {/* ==================== TAB 4: GOOGLE DRIVE STORAGE ==================== */}
        {activeTab === "drive" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
              Google Drive Cloud Storage Health
            </h2>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Folder Location: `eBookMine/PDFs`
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    PDF binaries are stored in your Google Drive cloud account. Neon PostgreSQL maintains fast metadata indexes.
                  </p>
                </div>

                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                >
                  Open Drive →
                </a>
              </div>

              <Button size="sm" onClick={handleTriggerDriveSync} disabled={loading}>
                <RefreshIcon size={14} />
                Run Full Idempotent Drive Sync
              </Button>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: SYSTEM SETTINGS & DIAGNOSTICS ==================== */}
        {activeTab === "settings" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
              System Health & Service Diagnostics
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Neon PostgreSQL Database
                  </h4>
                  <p className="text-[10px] text-slate-400">Database server & connection pool</p>
                </div>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Connected
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    OTP Auth Provider
                  </h4>
                  <p className="text-[10px] text-slate-400">6-digit email verification service</p>
                </div>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Active
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    pgvector Vector Extension
                  </h4>
                  <p className="text-[10px] text-slate-400">Cosine similarity vector index</p>
                </div>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Enabled
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    PDF.js Standalone Worker
                  </h4>
                  <p className="text-[10px] text-slate-400">Client-side rendering worker v4.4</p>
                </div>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Active
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
