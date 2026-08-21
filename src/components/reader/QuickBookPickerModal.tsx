"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useReaderTabs } from "./context/ReaderTabContext";
import { BookMeta } from "@/lib/types";
import {
  SearchIcon,
  XIcon,
  BookOpenIcon,
  CheckIcon,
  PlusIcon,
} from "@/components/ui/icons";
import { Spinner } from "@/components/ui";
import BookThumbnailImg from "@/components/BookThumbnailImg";
import { prefetchPdf } from "@/lib/pdfCache";

interface QuickBookPickerModalProps {
  theme?: "light" | "dark" | "sepia";
}

export default function QuickBookPickerModal({
  theme = "light",
}: QuickBookPickerModalProps) {
  const { quickPickerOpen, setQuickPickerOpen, openTab, tabs } = useReaderTabs();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    if (!quickPickerOpen) return;

    let isMounted = true;
    const fetchBooks = async () => {
      try {
        setLoading(true);
        const endpoint = isAuthenticated ? "/api/books" : "/api/public/books";
        const res = await fetch(endpoint);
        const data = await res.json();
        if (!isMounted) return;

        if (data.books && Array.isArray(data.books)) {
          setBooks(data.books);
        } else if (Array.isArray(data)) {
          setBooks(data);
        }
      } catch (err) {
        console.error("Error loading books for tab picker:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchBooks();
    return () => {
      isMounted = false;
    };
  }, [quickPickerOpen, isAuthenticated]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    books.forEach((b) => {
      if (b.category) cats.add(b.category);
    });
    return ["all", ...Array.from(cats)];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = search.toLowerCase().trim();
    return books.filter((b) => {
      const matchSearch =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.tags && b.tags.some((t) => t.toLowerCase().includes(q)));

      const matchCat =
        categoryFilter === "all" ||
        b.category?.toLowerCase() === categoryFilter.toLowerCase();

      return matchSearch && matchCat;
    });
  }, [books, search, categoryFilter]);

  if (!quickPickerOpen) return null;

  const isDark = theme === "dark";
  const isSepia = theme === "sepia";

  const containerBg = isDark
    ? "bg-slate-900 border-slate-700/80 text-white"
    : isSepia
    ? "bg-[#f4ecd8] border-[#d8cdb4] text-[#433422]"
    : "bg-white border-slate-200 text-slate-900";

  const dragHandleBg = isDark
    ? "bg-slate-700"
    : isSepia
    ? "bg-[#d8cdb4]"
    : "bg-slate-300";

  const headerBorder = isDark
    ? "border-slate-800"
    : isSepia
    ? "border-[#d8cdb4]"
    : "border-slate-100";

  const titleColor = isDark
    ? "text-white"
    : isSepia
    ? "text-[#433422]"
    : "text-slate-900";

  const subtitleColor = isDark
    ? "text-slate-400"
    : isSepia
    ? "text-[#7b6751]"
    : "text-slate-500";

  const searchBg = isDark
    ? "bg-slate-950/70 border-slate-800"
    : isSepia
    ? "bg-[#ebd9bd]/50 border-[#d8cdb4]"
    : "bg-slate-50/90 border-slate-100";

  const inputBg = isDark
    ? "bg-slate-800/90 border-slate-700 text-white placeholder:text-slate-500 focus:border-brand-500 focus:ring-brand-500/20"
    : isSepia
    ? "bg-[#fdfaf3] border-[#d4c5a9] text-[#433422] placeholder-[#9a8670] focus:border-[#a1783f] focus:ring-amber-500/20"
    : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500/10";

  const catInactive = isDark
    ? "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
    : isSepia
    ? "bg-[#ebd9bd] text-[#5c4731] hover:bg-[#ded3bc]"
    : "bg-slate-200/70 text-slate-600 hover:bg-slate-200";

  const bookCardNormal = isDark
    ? "bg-slate-800/80 border-slate-700/80 text-white hover:bg-slate-800 hover:border-slate-600"
    : isSepia
    ? "bg-[#fdfaf3] border-[#d8cdb4] text-[#433422] hover:bg-[#f7f0e0] hover:border-[#a1783f]"
    : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50 hover:border-brand-300 hover:shadow-sm";

  const bookCardActive = isDark
    ? "border-brand-500 bg-brand-950/50 shadow-md ring-1 ring-brand-500/30 text-white"
    : isSepia
    ? "border-[#a1783f] bg-[#ebd9bd]/70 shadow-md ring-1 ring-[#a1783f]/40 text-[#433422]"
    : "border-brand-400 bg-brand-50/70 shadow-sm ring-1 ring-brand-400/30 text-slate-900";

  const bookCardCategoryBadge = isDark
    ? "bg-slate-700/80 text-slate-300"
    : isSepia
    ? "bg-[#ebd9bd] text-[#5c4731]"
    : "bg-slate-100 text-slate-600";

  const closeButtonBg = isDark
    ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
    : isSepia
    ? "bg-[#ebd9bd] text-[#5c4731] hover:bg-[#ded3bc] hover:text-[#433422]"
    : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-md animate-fadeIn"
      onClick={() => setQuickPickerOpen(false)}
    >
      <div
        className={`relative flex max-h-[88vh] sm:max-h-[85vh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl border-t sm:border shadow-2xl backdrop-blur-xl overflow-hidden animate-slideUp sm:animate-scaleUp pb-6 sm:pb-0 ${containerBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Drag Pill Handle */}
        <div className={`mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full sm:hidden ${dragHandleBg}`} />

        {/* Header */}
        <div className={`flex items-center justify-between border-b p-4 ${headerBorder}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
              <BookOpenIcon size={20} />
            </div>
            <div>
              <h2 className={`text-sm sm:text-base font-bold ${titleColor}`}>
                Open Book in Tab
              </h2>
              <p className={`text-[11px] sm:text-xs ${subtitleColor}`}>
                Select a book to open in a new reading tab
              </p>
            </div>
          </div>
          <button
            onClick={() => setQuickPickerOpen(false)}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${closeButtonBg}`}
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Search & Category filter */}
        <div className={`border-b p-4 space-y-3 ${searchBg}`}>
          <div className="relative">
            <SearchIcon
              size={18}
              className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${subtitleColor}`}
            />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search books by title, author, or topic..."
              className={`w-full rounded-2xl border py-2.5 pl-10 pr-4 text-xs font-medium shadow-sm outline-none transition ${inputBg}`}
            />
          </div>

          {categories.length > 2 && (
            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 max-h-20 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold transition ${
                    categoryFilter === cat
                      ? "bg-brand-600 text-white shadow-sm shadow-brand-500/25"
                      : catInactive
                  }`}
                >
                  {cat === "all" ? "All Categories" : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Books List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[50vh]">
          {loading ? (
            <div className={`flex h-48 flex-col items-center justify-center gap-2 ${subtitleColor}`}>
              <Spinner size="md" />
              <span className="text-xs font-medium">Loading library books...</span>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className={`flex h-48 flex-col items-center justify-center gap-2 text-center ${subtitleColor}`}>
              <BookOpenIcon size={32} className="opacity-40" />
              <p className={`text-xs font-semibold ${titleColor}`}>
                No matching books found
              </p>
              <p className={`text-[11px] ${subtitleColor}`}>
                Try searching for a different title or author
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filteredBooks.map((book) => {
                const isOpen = tabs.some((t) => t.id === book.id);
                return (
                  <button
                    key={book.id}
                    onMouseEnter={() =>
                      prefetchPdf(
                        isAuthenticated
                          ? `/api/books/${book.id}/file`
                          : `/api/public/books/${book.id}/file`
                      )
                    }
                    onTouchStart={() =>
                      prefetchPdf(
                        isAuthenticated
                          ? `/api/books/${book.id}/file`
                          : `/api/public/books/${book.id}/file`
                      )
                    }
                    onClick={() => {
                      openTab(book, true);
                      setQuickPickerOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-all group ${
                      isOpen ? bookCardActive : bookCardNormal
                    }`}
                  >
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-black/5 dark:bg-white/10 shadow-inner">
                      <BookThumbnailImg
                        bookId={book.id}
                        cover={book.cover}
                        title={book.title}
                        className="h-full w-full"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className={`line-clamp-1 text-xs font-bold transition-colors group-hover:text-brand-500 ${titleColor}`}>
                        {book.title}
                      </h4>
                      <p className={`line-clamp-1 text-[11px] ${subtitleColor}`}>
                        {book.author || "Unknown Author"}
                      </p>
                      <div className={`mt-1 flex items-center gap-2 text-[10px] ${subtitleColor}`}>
                        {book.pageCount ? <span>{book.pageCount} pages</span> : null}
                        {book.category ? (
                          <span className={`rounded-md px-1.5 py-0.5 font-medium ${bookCardCategoryBadge}`}>
                            {book.category}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isOpen ? (
                      <span className="flex h-6 items-center gap-1 rounded-lg bg-brand-500/20 px-2 text-[10px] font-bold text-brand-600 dark:text-brand-300">
                        <CheckIcon size={12} strokeWidth={2.5} />
                        Open
                      </span>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 transition">
                        <PlusIcon size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
