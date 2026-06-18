"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Info icon (next to the theme toggle) that opens an "About" popup describing
 * the app's purpose and the developer credit. Replaces the footer, which was
 * unreachable on long, infinitely-scrolling library pages.
 */
export default function AboutButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="About eBookMine"
        title="About"
        className="rounded-lg px-2 py-1.5 text-lg leading-none text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        ℹ️
      </button>

      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-7 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close (X) */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ✕
            </button>

            <div className="text-center">
              <div className="text-5xl">📚</div>
              <h2 className="mt-3 text-xl font-bold tracking-tight">eBookMine</h2>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                eBookMine is a <span className="font-semibold">free, open digital
                library</span> built to make knowledge reachable for everyone —
                no sign-up, no paywalls, no limits.
              </p>
              <p>
                Our goal is simple: bring study guides, exam preparation, and
                great books to every learner, anywhere. Browse by category,
                search what you need, then read it online or download it to keep.
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                Built for students and curious minds — because learning should be
                accessible to all. 📖✨
              </p>
            </div>

            <div className="my-5 border-t border-slate-200 dark:border-slate-800" />

            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Developed by{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Hen Ty
                </span>
              </p>
              <a
                href="tel:010297859"
                className="mt-1 inline-block font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                📞 010 297 859
              </a>
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
