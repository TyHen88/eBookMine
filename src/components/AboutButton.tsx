"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./ui";
import { InfoIcon, LogoIcon, PhoneIcon, XIcon } from "./ui/icons";

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
      <IconButton
        onClick={() => setOpen(true)}
        aria-label="About eBookMine"
        title="About"
      >
        <InfoIcon size={19} />
      </IconButton>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white p-7 shadow-2xl shadow-brand-500/10 ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* accent bar */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600" />

              <IconButton
                onClick={() => setOpen(false)}
                aria-label="Close"
                size="icon-sm"
                className="absolute right-3 top-3 text-slate-400 hover:rotate-90"
              >
                <XIcon size={18} />
              </IconButton>

              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-lg shadow-brand-500/30">
                  <LogoIcon size={28} />
                </div>
                <h2 className="mt-3 text-xl font-bold tracking-tight">
                  eBookMine
                </h2>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  eBookMine is a{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    free, open digital library
                  </span>{" "}
                  built to make knowledge reachable for everyone — no sign-up, no
                  paywalls, no limits.
                </p>
                <p>
                  Our goal is simple: bring study guides, exam preparation, and
                  great books to every learner, anywhere. Browse by category,
                  search what you need, then read it online or download it to
                  keep.
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Built for students and curious minds — because learning should
                  be accessible to all.
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
                  className="mt-1.5 inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  <PhoneIcon size={15} />
                  010 297 859
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
