"use client";

import { useEffect, useState } from "react";

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
      className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-lg text-white shadow-lg transition hover:bg-brand-700"
    >
      ↑
    </button>
  );
}
