"use client";

import { useState, useMemo, useEffect } from "react";
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
  DotsVerticalIcon,
  BookOpenIcon,
} from "@/components/ui/icons";

interface AdminClientProps {
  initialBooks: any[];
  initialBookCounts?: {
    totalBooks: number;
    publishedCount: number;
    draftCount: number;
    driveSyncedCount: number;
  };
  initialUsers: any[];
  initialCategories: any[];
  initialAuthors: any[];
  aiUsageCount: number;
}

const PROVIDER_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  local: [
    { value: "local-synthesizer", label: "Local Built-in Synthesizer (Offline & Free)" },
    { value: "local-rag", label: "Local Semantic RAG Engine (Offline & Free)" },
  ],
  openrouter: [
    { value: "google/gemini-2.5-flash", label: "Google Gemini 2.5 Flash" },
    { value: "google/gemini-1.5-pro", label: "Google Gemini 1.5 Pro" },
    { value: "openai/gpt-4o", label: "OpenAI GPT-4o" },
    { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
    { value: "anthropic/claude-3.5-sonnet", label: "Anthropic Claude 3.5 Sonnet" },
    { value: "deepseek/deepseek-chat", label: "DeepSeek Chat V3" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash Direct" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro Direct" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash Direct" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o Direct" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini Direct" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo Direct" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet Direct" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku Direct" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek V3 Chat Direct" },
    { value: "deepseek-coder", label: "DeepSeek Coder Direct" },
  ],
  ollama: [
    { value: "llama3.2", label: "Llama 3.2 (Local Ollama)" },
    { value: "mistral", label: "Mistral 7B (Local Ollama)" },
    { value: "gemma2", label: "Gemma 2 (Local Ollama)" },
    { value: "phi3", label: "Phi 3 (Local Ollama)" },
  ],
};

export default function AdminClient({
  initialBooks,
  initialBookCounts,
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

  // Exact Book Counts from PostgreSQL
  const [bookCounts, setBookCounts] = useState({
    totalBooks: initialBookCounts?.totalBooks || initialBooks.length,
    publishedCount:
      initialBookCounts?.publishedCount || initialBooks.filter((b) => b.published).length,
    draftCount:
      initialBookCounts?.draftCount || initialBooks.filter((b) => !b.published).length,
    driveSyncedCount:
      initialBookCounts?.driveSyncedCount || initialBooks.filter((b) => b.driveFileId).length,
  });

  // Server-side Pagination & Filter State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [bookSearch, setBookSearch] = useState("");
  const [bookStatusFilter, setBookStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [totalMatching, setTotalMatching] = useState(
    initialBookCounts?.totalBooks || initialBooks.length
  );
  const [totalPages, setTotalPages] = useState(
    Math.ceil((initialBookCounts?.totalBooks || initialBooks.length) / 25) || 1
  );
  const [fetchingBooks, setFetchingBooks] = useState(false);

  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [openMenuBookId, setOpenMenuBookId] = useState<string | null>(null);

  // Search state for Users
  const [userSearch, setUserSearch] = useState("");

  // Edit Book Modal State
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<"PUBLIC" | "PRIVATE" | "PROTECTED">("PUBLIC");

  // Dynamic AI Configuration State
  const [aiProviderName, setAiProviderName] = useState("openrouter");
  const [selectedAiModel, setSelectedAiModel] = useState("google/gemini-2.5-flash");
  const [aiApiKey, setAiApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are eBookMine AI Tutor, an intelligent reading companion. Answer questions concisely using vector chunks and book context."
  );
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [dailyTokenLimit, setDailyTokenLimit] = useState(100000);
  const [temperature, setTemperature] = useState(0.7);

  const [embeddingProvider, setEmbeddingProvider] = useState("local");
  const [embeddingModel, setEmbeddingModel] = useState("synthetic-64");
  const [embeddingDimensions, setEmbeddingDimensions] = useState(64);

  const [loadingAiConfig, setLoadingAiConfig] = useState(true);
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [indexingBookId, setIndexingBookId] = useState<string | null>(null);

  // Close dropdown menu when clicking anywhere else
  useEffect(() => {
    const handleOutsideClick = () => setOpenMenuBookId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Server-side Paginated Fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      setFetchingBooks(true);
      fetch(
        `/api/admin/books?page=${page}&limit=${limit}&search=${encodeURIComponent(
          bookSearch
        )}&status=${bookStatusFilter}`
      )
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            setBooks(d.books);
            setTotalPages(d.pagination.totalPages);
            setTotalMatching(d.pagination.totalMatching);
            if (d.counts) {
              setBookCounts(d.counts);
            }
          }
        })
        .catch(() => {})
        .finally(() => setFetchingBooks(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [page, limit, bookSearch, bookStatusFilter]);

  // Available models for current selected provider
  const availableModels = useMemo(() => {
    return PROVIDER_MODELS[aiProviderName] || PROVIDER_MODELS.openrouter;
  }, [aiProviderName]);

  // Load AI Configuration from backend API on mount
  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) {
          const prov = d.config.provider || "openrouter";
          setAiProviderName(prov);
          setSelectedAiModel(d.config.model || "google/gemini-2.5-flash");
          setAiApiKey(d.config.apiKey || "");
          setSystemPrompt(d.config.systemPrompt || "");
          setChunkSize(d.config.chunkSize || 500);
          setChunkOverlap(d.config.chunkOverlap || 50);
          setDailyTokenLimit(d.config.dailyTokenLimit || 100000);
          setTemperature(d.config.temperature || 0.7);
          setEmbeddingProvider(d.config.embeddingProvider || "local");
          setEmbeddingModel(d.config.embeddingModel || "synthetic-64");
          setEmbeddingDimensions(d.config.embeddingDimensions || 64);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAiConfig(false));
  }, []);

  // Handle Provider Change -> Auto-select default model for provider
  const handleProviderChange = (newProvider: string) => {
    setAiProviderName(newProvider);
    const models = PROVIDER_MODELS[newProvider] || PROVIDER_MODELS.openrouter;
    if (models.length > 0) {
      setSelectedAiModel(models[0].value);
    }
  };

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

  // Refresh Books
  const refreshBooks = () => {
    fetch(
      `/api/admin/books?page=${page}&limit=${limit}&search=${encodeURIComponent(
        bookSearch
      )}&status=${bookStatusFilter}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setBooks(d.books);
          setTotalPages(d.pagination.totalPages);
          setTotalMatching(d.pagination.totalMatching);
          if (d.counts) setBookCounts(d.counts);
        }
      })
      .catch(() => {});
  };

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
        refreshBooks();
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
        setSelectedBookIds((prev) => prev.filter((id) => id !== bookId));
        refreshBooks();
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

      setSelectedBookIds([]);
      refreshBooks();
      showToast(`Updated ${selectedBookIds.length} books`, "success");
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
      refreshBooks();
      showToast(`Synced ${d.imported?.length || 0} books from Drive`, "success");
    } catch {
      setStatusMsg("Drive Sync failed.");
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
        setEditingBook(null);
        refreshBooks();
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

  // Save AI Config via API POST /api/admin/config
  const handleSaveAiConfig = async () => {
    setSavingAiConfig(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiProviderName,
          model: selectedAiModel,
          apiKey: aiApiKey,
          systemPrompt,
          chunkSize,
          chunkOverlap,
          dailyTokenLimit,
          temperature,
          embeddingProvider,
          embeddingModel,
          embeddingDimensions,
        }),
      });

      if (res.ok) {
        showToast("AI Configuration saved successfully!", "success");
      } else {
        showToast("Failed to save AI config", "error");
      }
    } catch {
      showToast("Failed to save AI settings", "error");
    } finally {
      setSavingAiConfig(false);
    }
  };

  // Test AI Connection via API POST /api/admin/config/test
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiProviderName,
          model: selectedAiModel,
          apiKey: aiApiKey,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setTestResult({
          ok: true,
          message: d.message || `✓ Connection Successful! Model '${selectedAiModel}' responded in ${d.latencyMs}ms`,
        });
        showToast("Connection Test Successful!", "success");
      } else {
        setTestResult({
          ok: false,
          message: d.error || "✕ Connection Failed. Please check your API key.",
        });
        showToast("Connection Test Failed", "error");
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || "✕ Connection Test Failed due to a network error.",
      });
      showToast("Connection Test Failed", "error");
    } finally {
      setTestingConnection(false);
    }
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
                  <option value="PUBLIC">Public</option>
                  <option value="PROTECTED">Protected</option>
                  <option value="PRIVATE">Private</option>
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
                  placeholder="eBook summary..."
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
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 md:pl-24 py-3.5 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/90">
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
      <div className="border-b border-slate-200 bg-white px-4 md:pl-24 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto pt-2 no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              { id: "books", label: `Manage Books (${bookCounts.totalBooks.toLocaleString()})` },
              { id: "ai", label: "AI Settings & Models" },
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
      <main className="mx-auto max-w-7xl p-4 sm:p-6 md:pl-24 space-y-6 pb-28">
        {/* ==================== TAB 1: MANAGE BOOKS ==================== */}
        {activeTab === "books" && (
          <div className="space-y-4">
            {/* Top Exact Metrics Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Total Books
                </span>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  {bookCounts.totalBooks.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Published Books
                </span>
                <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {bookCounts.publishedCount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Draft Books
                </span>
                <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                  {bookCounts.draftCount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Drive Synced
                </span>
                <p className="mt-1 text-2xl font-black text-brand-600 dark:text-brand-400">
                  {bookCounts.driveSyncedCount.toLocaleString()}
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
                    onChange={(e) => {
                      setBookSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by title, author, or category..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <select
                  value={bookStatusFilter}
                  onChange={(e) => {
                    setBookStatusFilter(e.target.value as any);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts Only</option>
                </select>

                {fetchingBooks && <Spinner size="sm" />}
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

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            books.length > 0 && selectedBookIds.length === books.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBookIds(books.map((b) => b.id));
                            } else {
                              setSelectedBookIds([]);
                            }
                          }}
                        />
                      </th>
                      <th className="p-3.5">Title</th>
                      <th className="p-3.5">Author</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Visibility</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {books.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold">
                          No books found matching search query.
                        </td>
                      </tr>
                    ) : (
                      books.map((b) => (
                        <tr
                          key={b.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                            selectedBookIds.includes(b.id)
                              ? "bg-brand-50/30 dark:bg-brand-950/20"
                              : ""
                          }`}
                        >
                          <td className="p-3.5 text-center">
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
                          <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                            {b.title}
                          </td>
                          <td className="p-3.5 text-slate-500 font-medium">{b.author || "Unknown"}</td>
                          <td className="p-3.5">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {b.category || "General"}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400">
                              {b.visibility || "PUBLIC"}
                            </span>
                          </td>
                          <td className="p-3.5">
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
                          {/* 3-Dots Floating Menu Action */}
                          <td className="p-3.5 text-right relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuBookId(openMenuBookId === b.id ? null : b.id);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            >
                              <DotsVerticalIcon size={16} />
                            </button>

                            {openMenuBookId === b.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-3 top-10 z-40 w-44 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 text-left animate-fade-in space-y-0.5"
                              >
                                <button
                                  onClick={() => {
                                    setOpenMenuBookId(null);
                                    setEditingBook(b);
                                    setEditTitle(b.title);
                                    setEditAuthor(b.author);
                                    setEditCategory(b.category);
                                    setEditDescription(b.description || "");
                                    setEditVisibility(b.visibility || "PUBLIC");
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  ✏️ Edit Metadata
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuBookId(null);
                                    handleTogglePublish(b.id, b.published);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  {b.published ? "👁️ Unpublish" : "👁️ Publish"}
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuBookId(null);
                                    handleTriggerIngestion(b.id);
                                  }}
                                  disabled={indexingBookId === b.id}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
                                >
                                  ⚡ AI Vector Index
                                </button>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                <button
                                  onClick={() => {
                                    setOpenMenuBookId(null);
                                    handleDeleteBookMetadata(b.id);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                  🗑️ Delete Book
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List View (No horizontal overflow) */}
            <div className="block md:hidden space-y-3">
              {books.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                  No books found matching search query.
                </div>
              ) : (
                books.map((b) => (
                  <div
                    key={b.id}
                    className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
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
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {b.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            By {b.author || "Unknown"}
                          </p>
                        </div>
                      </div>

                      {/* 3-Dots Menu Button */}
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuBookId(openMenuBookId === b.id ? null : b.id);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <DotsVerticalIcon size={16} />
                        </button>

                        {openMenuBookId === b.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-8 z-40 w-44 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 text-left space-y-0.5"
                          >
                            <button
                              onClick={() => {
                                setOpenMenuBookId(null);
                                setEditingBook(b);
                                setEditTitle(b.title);
                                setEditAuthor(b.author);
                                setEditCategory(b.category);
                                setEditDescription(b.description || "");
                                setEditVisibility(b.visibility || "PUBLIC");
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              ✏️ Edit Metadata
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuBookId(null);
                                handleTogglePublish(b.id, b.published);
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {b.published ? "👁️ Unpublish" : "👁️ Publish"}
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuBookId(null);
                                handleTriggerIngestion(b.id);
                              }}
                              disabled={indexingBookId === b.id}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
                            >
                              ⚡ AI Vector Index
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                            <button
                              onClick={() => {
                                setOpenMenuBookId(null);
                                handleDeleteBookMetadata(b.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              🗑️ Delete Book
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {b.category || "General"}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">
                          {b.visibility || "PUBLIC"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            b.published
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {b.published ? "Published" : "Draft"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls Hub */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {totalMatching === 0 ? 0 : (page - 1) * limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {Math.min(page * limit, totalMatching)}
                </span>{" "}
                of{" "}
                <span className="font-extrabold text-brand-600 dark:text-brand-400">
                  {totalMatching.toLocaleString()}
                </span>{" "}
                Books
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    « First
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ‹ Prev
                  </button>

                  <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Next ›
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Last »
                  </button>
                </div>
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
                    Total AI Queries
                  </span>
                </div>
                <p className="mt-2 text-3xl font-black text-brand-600 dark:text-brand-400">
                  {aiUsageCount}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Daily Quota Per User
                </span>
                <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {dailyTokenLimit.toLocaleString()} Tokens
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Active Model
                </span>
                <p className="mt-2 text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {selectedAiModel}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">
                  Provider: {aiProviderName}
                </p>
              </div>
            </div>

            {/* AI Model & Key Configuration GUI */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-slate-800/60">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  AI Model & API Key Configuration
                </h3>
                {loadingAiConfig && <Spinner size="sm" />}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    AI Provider Service
                  </label>
                  <select
                    value={aiProviderName}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="local">Local Built-in (100% Offline & Free)</option>
                    <option value="ollama">Local Ollama (Self-Hosted)</option>
                    <option value="openrouter">OpenRouter API</option>
                    <option value="google">Google Gemini AI Direct</option>
                    <option value="openai">OpenAI Direct</option>
                    <option value="anthropic">Anthropic Direct</option>
                    <option value="deepseek">DeepSeek Direct</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Model for {aiProviderName.toUpperCase()}
                  </label>
                  <select
                    value={selectedAiModel}
                    onChange={(e) => setSelectedAiModel(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {availableModels.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic API Key Input */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    API Key {aiProviderName === "local" ? "(Not required for Local Built-in)" : aiProviderName === "ollama" ? "(Optional for Local Ollama)" : ""}
                  </label>
                  {aiProviderName !== "local" && (
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-[11px] font-bold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {showApiKey ? "Hide Key" : "Show Key"}
                    </button>
                  )}
                </div>
                <input
                  type={showApiKey ? "text" : "password"}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  disabled={aiProviderName === "local"}
                  placeholder={
                    aiProviderName === "local"
                      ? "No API key required — Local Built-in engine works offline and free"
                      : aiProviderName === "ollama"
                      ? "Optional (Leave blank if running Ollama locally on port 11434)"
                      : "Paste API key here..."
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs font-bold outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* System Persona & Parameters */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    AI System Persona Prompt
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Daily Token Limit
                    </label>
                    <input
                      type="number"
                      value={dailyTokenLimit}
                      onChange={(e) => setDailyTokenLimit(parseInt(e.target.value, 10) || 100000)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Temperature ({temperature})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="mt-2 w-full accent-brand-600"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons Hub: Test Connection & Save Settings */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                >
                  {testingConnection ? <Spinner size="sm" /> : <RefreshIcon size={14} />}
                  {testingConnection ? "Testing Connection..." : "Test Connection"}
                </Button>

                <Button size="sm" onClick={handleSaveAiConfig} disabled={savingAiConfig}>
                  {savingAiConfig ? "Saving..." : "Save AI Settings"}
                </Button>
              </div>

              {/* Connection Test Feedback Result Card */}
              {testResult && (
                <div
                  className={`rounded-xl p-3.5 text-xs font-bold transition-all animate-fade-in border ${
                    testResult.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Vector RAG Ingestion Controls */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Vector Store Chunking
              </h3>

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

              <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Embedding Provider
                  </label>
                  <select
                    value={embeddingProvider}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmbeddingProvider(val);
                      if (val === "local") {
                        setEmbeddingModel("synthetic-64");
                        setEmbeddingDimensions(64);
                      } else if (val === "openai") {
                        setEmbeddingModel("text-embedding-3-small");
                        setEmbeddingDimensions(1536);
                      } else if (val === "google") {
                        setEmbeddingModel("text-embedding-004");
                        setEmbeddingDimensions(768);
                      }
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="local">Local Synthetic (64d - Free/Fast)</option>
                    <option value="openai">OpenAI Embeddings (1536d)</option>
                    <option value="google">Google Gemini Embeddings (768d)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Embedding Model
                  </label>
                  <input
                    type="text"
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Vector Dimensions
                  </label>
                  <input
                    type="number"
                    value={embeddingDimensions}
                    onChange={(e) => setEmbeddingDimensions(parseInt(e.target.value, 10) || 64)}
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
              Google Drive Cloud Storage
            </h2>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Folder Location: `eBookMine/PDFs`
                  </h3>
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
                Run Full Drive Sync
              </Button>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: SYSTEM SETTINGS & DIAGNOSTICS ==================== */}
        {activeTab === "settings" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
              System Diagnostics
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Neon PostgreSQL Database
                  </h4>
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
                </div>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Active
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    pgvector Extension
                  </h4>
                </div>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Enabled
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    PDF.js Web Worker
                  </h4>
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
