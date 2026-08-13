"use client";

import { useEffect, useState } from "react";
import { ChevronUpIcon } from "./ui/icons";

/**
 * Floating "back to top" button. Appears after the page is scrolled down past
 * a threshold and smoothly scrolls the window back to the top when clicked.
 */
export default function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      title="Back to top"
      className="fixed bottom-20 right-6 md:bottom-8 md:right-8 z-40 flex h-10 w-10 md:h-11 md:w-11 animate-pop-in items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/40 ring-2 ring-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/50 active:scale-95"
    >
      <ChevronUpIcon size={20} />
    </button>
  );
}
