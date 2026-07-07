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
      className="fixed bottom-6 right-6 z-40 flex h-11 w-11 animate-pop-in items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/50"
    >
      <ChevronUpIcon size={22} />
    </button>
  );
}
