"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import anime from "animejs";
import { useSession } from "next-auth/react";
import { BookMeta } from "@/lib/types";
import { AiMarkdownView, Button, Spinner } from "./ui";
import { useToast } from "./ui/Toast";
import { BookOpenIcon, CheckIcon, SearchIcon, SparklesIcon, XIcon } from "./ui/icons";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  latencyMs?: number;
  isTyping?: boolean;
}

const DEFAULT_GEMINI_MODEL = "google/gemini-2.5-flash-lite";

const THINKING_STEPS = [
  "eMax is analyzing book context...",
  "Synthesizing key insights...",
  "Formatting clean Markdown response...",
];

/**
 * Small eMax Mini Robot Avatar (matching the FloatingAiBot chibi character)
 */
function EMaxMiniAvatar({
  size = 28,
  state = "idle",
  onClick,
}: {
  size?: number;
  state?: "idle" | "thinking" | "responding";
  onClick?: () => void;
}) {
  const avatarRef = useRef<SVGSVGElement>(null);

  const handlePoke = () => {
    if (avatarRef.current) {
      anime({
        targets: avatarRef.current,
        scale: [1, 1.24, 0.92, 1],
        rotate: [0, -12, 12, 0],
        duration: 460,
        easing: "easeOutElastic(1, .5)",
      });
    }
    onClick?.();
  };

  return (
    <div
      onClick={onClick ? handlePoke : undefined}
      title={onClick ? "Poke eMax!" : "eMax AI"}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 p-1 ring-1 ring-purple-400/35 shadow-sm ${
        onClick ? "cursor-pointer active:scale-95" : ""
      } ${state === "thinking" ? "ring-2 ring-purple-400/80 shadow-purple-500/30" : ""}`}
      style={{ width: size, height: size }}
    >
      {state !== "idle" && (
        <span
          className={`pointer-events-none absolute -inset-0.5 rounded-2xl opacity-60 blur-[2px] ${
            state === "thinking"
              ? "animate-pulse bg-gradient-to-r from-purple-500 via-cyan-400 to-indigo-500"
              : "animate-pulse bg-gradient-to-r from-emerald-400 to-purple-500"
          }`}
        />
      )}
      <svg
        ref={avatarRef}
        viewBox="0 0 200 175"
        className="relative h-full w-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M58 122 C75 132, 125 132, 142 122 L138 136 C118 148, 82 148, 62 136 Z"
          fill="#2563eb"
          stroke="#0d0b26"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <ellipse
          cx="100"
          cy="68"
          rx="58"
          ry="52"
          fill="#191240"
          stroke="#0d0b26"
          strokeWidth="6"
        />
        <rect
          x="42"
          y="32"
          width="116"
          height="94"
          rx="43"
          fill="#ede9fe"
          stroke="#0d0b26"
          strokeWidth="6.5"
        />
        <rect
          x="24"
          y="56"
          width="24"
          height="52"
          rx="12"
          fill="#ddd6fe"
          stroke="#0d0b26"
          strokeWidth="6"
        />
        <ellipse cx="33" cy="82" rx="4.5" ry="12" fill="#2563eb" />
        <rect
          x="152"
          y="56"
          width="24"
          height="52"
          rx="12"
          fill="#ddd6fe"
          stroke="#0d0b26"
          strokeWidth="6"
        />
        <ellipse cx="167" cy="82" rx="4.5" ry="12" fill="#2563eb" />
        <rect
          x="55"
          y="47"
          width="90"
          height="66"
          rx="28"
          fill="#0b102d"
          stroke="#0d0b26"
          strokeWidth="6"
        />
        <rect
          x="84"
          y="15"
          width="32"
          height="18"
          rx="6"
          fill="#ede9fe"
          stroke="#0d0b26"
          strokeWidth="5.5"
        />
        <rect
          x="86"
          y="29"
          width="28"
          height="15"
          rx="5"
          fill="#ede9fe"
          stroke="#2563eb"
          strokeWidth="4.5"
        />
        {state === "thinking" ? (
          <>
            <circle cx="80" cy="83" r="10" fill="#c084fc" className="animate-ping" />
            <circle cx="80" cy="83" r="8" fill="#f3e8ff" />
            <circle cx="120" cy="83" r="10" fill="#38bdf8" className="animate-ping" />
            <circle cx="120" cy="83" r="8" fill="#e0f2fe" />
          </>
        ) : state === "responding" ? (
          <>
            <rect x="69" y="76" width="22" height="14" rx="7" fill="#a855f7" />
            <rect x="72" y="79" width="16" height="8" rx="4" fill="#ffffff" />
            <rect x="109" y="76" width="22" height="14" rx="7" fill="#a855f7" />
            <rect x="112" y="79" width="16" height="8" rx="4" fill="#ffffff" />
          </>
        ) : (
          <>
            <rect x="70" y="79" width="20" height="7" rx="3.5" fill="#d8b4fe" />
            <rect x="110" y="79" width="20" height="7" rx="3.5" fill="#d8b4fe" />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * Clean, Strictly Left-Aligned Chat Bubble with eMax Avatar and fast Markdown reveal.
 */
function ChatBubble({
  message,
  isLatest,
  onCopy,
  onStreamingChange,
}: {
  message: Message;
  isLatest: boolean;
  onCopy: (text: string) => void;
  onStreamingChange?: (streaming: boolean) => void;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [displayedText, setDisplayedText] = useState(
    message.role === "assistant" && isLatest && message.isTyping ? "" : message.content
  );
  const [isStreaming, setIsStreaming] = useState(
    Boolean(message.role === "assistant" && isLatest && message.isTyping)
  );

  useEffect(() => {
    if (!bubbleRef.current) return;
    anime({
      targets: bubbleRef.current,
      translateY: [10, 0],
      opacity: [0, 1],
      duration: 280,
      easing: "easeOutCubic",
    });
  }, []);

  useEffect(() => {
    if (message.role === "assistant" && isLatest && message.isTyping) {
      let idx = 0;
      const fullText = message.content;
      const step = Math.max(10, Math.ceil(fullText.length / 22));
      setIsStreaming(true);
      onStreamingChange?.(true);

      const interval = setInterval(() => {
        idx += step;
        if (idx >= fullText.length) {
          setDisplayedText(fullText);
          setIsStreaming(false);
          onStreamingChange?.(false);
          clearInterval(interval);
        } else {
          setDisplayedText(fullText.slice(0, idx));
        }
      }, 14);
      return () => {
        clearInterval(interval);
        onStreamingChange?.(false);
      };
    } else {
      setDisplayedText(message.content);
      setIsStreaming(false);
    }
  }, [message, isLatest, onStreamingChange]);

  const isUser = message.role === "user";

  return (
    <div
      ref={bubbleRef}
      className={`group relative flex w-full items-start gap-2.5 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* eMax Mini Robot Avatar on every assistant message */}
      {!isUser && (
        <EMaxMiniAvatar size={28} state={isStreaming ? "responding" : "idle"} />
      )}

      <div
        className={`min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2.5 text-left text-xs transition-all ${
          isUser
            ? "rounded-tr-sm bg-gradient-to-r from-indigo-600 to-purple-600 font-medium text-white shadow-sm"
            : `rounded-tl-sm border bg-slate-900/95 text-slate-100 shadow-sm ${
                isStreaming
                  ? "border-purple-500/60 ring-1 ring-purple-500/25"
                  : "border-slate-800/90"
              }`
        }`}
      >
        {!isUser ? (
          <AiMarkdownView
            content={displayedText}
            isTyping={isStreaming}
            className="text-left text-slate-100 [&_strong]:text-white [&_p]:text-slate-200 [&_h4]:text-white [&_h5]:text-purple-300"
          />
        ) : (
          <p className="text-left whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}

        <div
          className={`mt-1.5 flex items-center justify-between gap-2 text-[10px] ${
            isUser ? "justify-end text-white/70" : "text-slate-500"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span>{message.timestamp}</span>
            {!isUser && isStreaming && (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Responding...
              </span>
            )}
            {!isUser && !isStreaming && message.latencyMs && (
              <span className="font-medium text-slate-500">
                • {(message.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          {!isUser && (
            <button
              type="button"
              onClick={() => onCopy(message.content)}
              className="rounded px-1.5 py-0.5 text-[9px] font-bold text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10 hover:text-white"
            >
              Copy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive Thinking Card with anime.js waveform bars
 */
function InteractiveThinkingCard({
  stepIndex,
  pokes,
  onPoke,
}: {
  stepIndex: number;
  pokes: number;
  onPoke: () => void;
}) {
  const waveContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!waveContainerRef.current) return;
    const bars = waveContainerRef.current.querySelectorAll(".emax-wave-bar");
    const anim = anime({
      targets: bars,
      scaleY: [0.35, 1.45, 0.4],
      opacity: [0.5, 1, 0.5],
      duration: 560,
      delay: anime.stagger(85),
      loop: true,
      direction: "alternate",
      easing: "easeInOutSine",
    });
    return () => anim.pause();
  }, []);

  return (
    <div className="flex items-start gap-2.5 animate-fade-in">
      <EMaxMiniAvatar size={28} state="thinking" onClick={onPoke} />

      <div
        onClick={onPoke}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPoke();
          }
        }}
        className="group relative flex-1 cursor-pointer overflow-hidden rounded-2xl rounded-tl-sm border border-purple-500/45 bg-slate-900/95 px-3.5 py-2.5 text-left shadow-md transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              ref={waveContainerRef}
              className="flex h-4 items-center gap-1"
            >
              <span className="emax-wave-bar h-3 w-1 rounded-full bg-purple-400" />
              <span className="emax-wave-bar h-3.5 w-1 rounded-full bg-cyan-400" />
              <span className="emax-wave-bar h-3 w-1 rounded-full bg-fuchsia-400" />
              <span className="emax-wave-bar h-3.5 w-1 rounded-full bg-indigo-400" />
            </div>
            <span className="text-[11px] font-bold text-white">
              {THINKING_STEPS[stepIndex % THINKING_STEPS.length]}
            </span>
          </div>
          {pokes > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-extrabold text-amber-300 ring-1 ring-amber-400/40">
              ⚡ x{pokes}
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-slate-400 group-hover:text-purple-300 transition-colors">
          Tap eMax to interact while thinking
        </p>
      </div>
    </div>
  );
}

const BOT_WIDTH = 86;
const BOT_HEIGHT = 96;
const EDGE_PADDING = 12;
const TOP_PADDING = 16;
const BOTTOM_PADDING = 20;

function getAssistiveTouchSnapTarget(
  x: number,
  y: number,
  vw: number,
  vh: number
): { x: number; y: number; edgeLabel: string } {
  const minX = EDGE_PADDING;
  const maxX = Math.max(minX, vw - BOT_WIDTH - EDGE_PADDING);
  const minY = TOP_PADDING;
  const maxY = Math.max(minY, vh - BOT_HEIGHT - BOTTOM_PADDING);

  const clampedX = Math.max(minX, Math.min(x, maxX));
  const clampedY = Math.max(minY, Math.min(y, maxY));

  const distLeft = clampedX - minX;
  const distRight = maxX - clampedX;
  const distTop = clampedY - minY;
  const distBottom = maxY - clampedY;

  const edgeThreshold = 75;
  if (distTop < edgeThreshold && distTop < distLeft && distTop < distRight) {
    return { x: clampedX, y: minY, edgeLabel: "docked top edge" };
  }
  if (distBottom < edgeThreshold && distBottom < distLeft && distBottom < distRight) {
    return { x: clampedX, y: maxY, edgeLabel: "docked bottom edge" };
  }
  if (distLeft <= distRight) {
    return { x: minX, y: clampedY, edgeLabel: "docked left edge" };
  }
  return { x: maxX, y: clampedY, edgeLabel: "docked right edge" };
}

export default function FloatingAiBot() {
  const { status } = useSession();
  const isOwner = status === "authenticated";
  const { showToast } = useToast();

  // Positioning & AssistiveTouch State
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ w: 1200, h: 800 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [isIdleDimmed, setIsIdleDimmed] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  // Chat UI State (Clean empty chat by default, powered by Gemini 2.5 Flash)
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);

  // Thinking & Responding Animation States
  const [loading, setLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [thinkingPokes, setThinkingPokes] = useState(0);
  const [thinkingReaction, setThinkingReaction] = useState<string | null>(null);

  // Book Context & Search
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Messages
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // DOM & SVG Refs for anime.js
  const botContainerRef = useRef<HTMLDivElement>(null);
  const handleButtonRef = useRef<HTMLButtonElement>(null);
  const floatWrapRef = useRef<HTMLDivElement>(null);
  const headGroupRef = useRef<SVGGElement>(null);
  const visorGazeRef = useRef<SVGGElement>(null);
  const leftUpperLidRef = useRef<SVGRectElement>(null);
  const leftLowerLidRef = useRef<SVGRectElement>(null);
  const rightUpperLidRef = useRef<SVGRectElement>(null);
  const rightLowerLidRef = useRef<SVGRectElement>(null);
  const leftEyeGlowBarRef = useRef<SVGRectElement>(null);
  const rightEyeGlowBarRef = useRef<SVGRectElement>(null);
  const leftArmRef = useRef<SVGGElement>(null);
  const rightArmRef = useRef<SVGGElement>(null);
  const leftBootRef = useRef<SVGGElement>(null);
  const rightBootRef = useRef<SVGGElement>(null);
  const earGlowRef = useRef<SVGGElement>(null);
  const thinkingHaloRef = useRef<SVGCircleElement>(null);

  const dragStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    moved: false,
  });

  const snapAnimRef = useRef<anime.AnimeInstance | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const resetIdleTimer = useCallback(() => {
    setIsIdleDimmed(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current && !isOpenRef.current) {
        setIsIdleDimmed(true);
      }
    }, 3200);
  }, []);

  const announceMove = useCallback((description: string) => {
    setLiveAnnouncement(`eMax Bot moved ${description}`);
    const t = setTimeout(() => setLiveAnnouncement(""), 1200);
    return () => clearTimeout(t);
  }, []);

  const moveTo = useCallback((left: number, top: number, commitState = true) => {
    if (typeof window === "undefined") return { x: left, y: top };
    const maxLeft = Math.max(EDGE_PADDING, window.innerWidth - BOT_WIDTH - EDGE_PADDING);
    const maxTop = Math.max(TOP_PADDING, window.innerHeight - BOT_HEIGHT - BOTTOM_PADDING);
    const clampedX = Math.round(Math.max(EDGE_PADDING, Math.min(left, maxLeft)));
    const clampedY = Math.round(Math.max(TOP_PADDING, Math.min(top, maxTop)));
    posRef.current = { x: clampedX, y: clampedY };

    if (botContainerRef.current) {
      botContainerRef.current.style.left = `${clampedX}px`;
      botContainerRef.current.style.top = `${clampedY}px`;
    }
    if (commitState) {
      setPos({ x: clampedX, y: clampedY });
    }
    return { x: clampedX, y: clampedY };
  }, []);

  const snapToNearestEdge = useCallback(
    (fromX: number, fromY: number) => {
      if (typeof window === "undefined") return;
      snapAnimRef.current?.pause();
      const target = getAssistiveTouchSnapTarget(
        fromX,
        fromY,
        window.innerWidth,
        window.innerHeight
      );
      const animObj = { x: fromX, y: fromY };

      snapAnimRef.current = anime({
        targets: animObj,
        x: target.x,
        y: target.y,
        duration: 420,
        easing: "easeOutBack",
        update: () => {
          moveTo(animObj.x, animObj.y, false);
        },
        complete: () => {
          moveTo(target.x, target.y, true);
          try {
            localStorage.setItem(
              "ebookmine_ai_bot_pos",
              JSON.stringify({ x: target.x, y: target.y })
            );
          } catch {
            // ignore
          }
          announceMove(target.edgeLabel);
          resetIdleTimer();
        },
      });
    },
    [moveTo, announceMove, resetIdleTimer]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewport({ w: vw, h: vh });

    let initX = Math.max(EDGE_PADDING, vw - BOT_WIDTH - EDGE_PADDING);
    let initY = Math.round(vh * 0.68);

    try {
      const saved = localStorage.getItem("ebookmine_ai_bot_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const snapped = getAssistiveTouchSnapTarget(parsed.x, parsed.y, vw, vh);
          initX = snapped.x;
          initY = snapped.y;
        }
      } else {
        const snapped = getAssistiveTouchSnapTarget(initX, initY, vw, vh);
        initX = snapped.x;
        initY = snapped.y;
      }
    } catch {
      // ignore
    }

    posRef.current = { x: initX, y: initY };
    setPos({ x: initX, y: initY });
    setMounted(true);
    resetIdleTimer();

    const onResize = () => {
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      setViewport({ w: newW, h: newH });
      const snapped = getAssistiveTouchSnapTarget(
        posRef.current.x,
        posRef.current.y,
        newW,
        newH
      );
      moveTo(snapped.x, snapped.y, true);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [moveTo, resetIdleTimer]);

  useEffect(() => {
    const handleOpenBot = (e: Event) => {
      const customEvent = e as CustomEvent<{ bookId?: string }>;
      setIsOpen(true);
      setIsIdleDimmed(false);
      if (customEvent.detail?.bookId && books.length > 0) {
        const found = books.find(
          (b: any) =>
            b.id === customEvent.detail?.bookId ||
            b.driveFileId === customEvent.detail?.bookId
        );
        if (found) setSelectedBook(found);
      }
    };
    window.addEventListener("open-ai-bot", handleOpenBot);
    return () => window.removeEventListener("open-ai-bot", handleOpenBot);
  }, [books]);

  useEffect(() => {
    const apiBase = isOwner ? "/api/books" : "/api/public/books";
    fetch(apiBase)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (Array.isArray(d)) setBooks(d);
      })
      .catch(() => {});
  }, [isOwner]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(books.slice(0, 8));
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/public/books/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setSearchResults(d.books || []);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery, books]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isResponding, isOpen]);

  useEffect(() => {
    if (!loading) {
      setThinkingStep(0);
      setThinkingPokes(0);
      setThinkingReaction(null);
      return;
    }

    const stepInterval = setInterval(() => {
      setThinkingStep((s) => s + 1);
    }, 550);

    const headAnim = headGroupRef.current
      ? anime({
          targets: headGroupRef.current,
          translateY: [-3, 2],
          duration: 380,
          direction: "alternate",
          loop: true,
          easing: "easeInOutSine",
        })
      : null;

    const haloAnim = thinkingHaloRef.current
      ? anime({
          targets: thinkingHaloRef.current,
          r: [68, 82],
          opacity: [0.65, 0],
          duration: 900,
          loop: true,
          easing: "easeOutQuad",
        })
      : null;

    return () => {
      clearInterval(stepInterval);
      headAnim?.pause();
      haloAnim?.pause();
    };
  }, [loading]);

  const handleInteractiveThinkingPoke = useCallback(() => {
    setThinkingPokes((prev) => prev + 1);
    const reactions = [
      "⚡ Turbocharging eMax neural engine!",
      "🧠 Scanning pages at warp speed!",
      "✨ Formatting Markdown insights!",
      "🚀 Maximum eMax boost active!",
    ];
    setThinkingReaction(reactions[Math.floor(Math.random() * reactions.length)]);

    if (floatWrapRef.current) {
      anime({
        targets: floatWrapRef.current,
        translateY: [0, -14, 0],
        scale: [1, 1.16, 0.94, 1],
        duration: 480,
        easing: "easeOutElastic(1, .5)",
      });
    }
    if (leftArmRef.current && rightArmRef.current) {
      anime({
        targets: [leftArmRef.current, rightArmRef.current],
        translateY: [0, -6, 0],
        duration: 320,
        easing: "easeOutBack",
      });
    }
  }, []);

  // 1. anime.js Continuous Gentle Breathing Float, Arm Swing & Ear Pulse
  useEffect(() => {
    if (!mounted) return;
    const floatEl = floatWrapRef.current;
    const lArmEl = leftArmRef.current;
    const rArmEl = rightArmRef.current;
    const lBootEl = leftBootRef.current;
    const rBootEl = rightBootRef.current;
    const earEl = earGlowRef.current;

    const floatAnim = anime({
      targets: floatEl,
      translateY: [-3, 3],
      duration: 2200,
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });

    const leftArmAnim = anime({
      targets: lArmEl,
      translateY: [-1.2, 1.2],
      duration: 1800,
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });

    const rightArmAnim = anime({
      targets: rArmEl,
      translateY: [1.2, -1.2],
      duration: 1800,
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });

    const bootAnim = anime({
      targets: [lBootEl, rBootEl],
      translateY: (_el: HTMLElement, i: number) => (i === 0 ? [-1, 1.2] : [1.2, -1]),
      duration: 1600,
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });

    const earGlowAnim = anime({
      targets: earEl,
      opacity: [0.55, 1],
      duration: 1500,
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });

    return () => {
      floatAnim.pause();
      leftArmAnim.pause();
      rightArmAnim.pause();
      bootAnim.pause();
      earGlowAnim.pause();
    };
  }, [mounted]);

  // 2. Smooth SVG Eyelid Open/Close Animation via anime.js
  useEffect(() => {
    if (!mounted) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const triggerBlink = () => {
      if (cancelled) return;
      const upperLids = [leftUpperLidRef.current, rightUpperLidRef.current].filter(Boolean);
      const lowerLids = [leftLowerLidRef.current, rightLowerLidRef.current].filter(Boolean);
      const glowBars = [leftEyeGlowBarRef.current, rightEyeGlowBarRef.current].filter(Boolean);

      if (upperLids.length === 0 || lowerLids.length === 0) return;

      const r = Math.random();
      const holdDuration = r < 0.3 ? 1100 : r < 0.6 ? 120 : 60;
      const isDouble = holdDuration === 60 && Math.random() < 0.45;

      const tl = anime.timeline({
        easing: "easeInOutQuad",
        complete: () => {
          if (!cancelled) {
            timer = setTimeout(triggerBlink, 2200 + Math.random() * 2600);
          }
        },
      });

      tl.add(
        {
          targets: upperLids,
          height: [0, 10.5],
          duration: 140,
        },
        0
      )
        .add(
          {
            targets: lowerLids,
            y: [96, 85.5],
            height: [0, 10.5],
            duration: 140,
          },
          0
        )
        .add(
          {
            targets: glowBars,
            rx: [5.5, 2],
            height: [11, 3.6],
            y: [78.5, 82.2],
            duration: 140,
          },
          0
        )
        .add({
          targets: upperLids,
          height: 0,
          duration: 180,
          delay: holdDuration,
        })
        .add(
          {
            targets: lowerLids,
            y: 96,
            height: 0,
            duration: 180,
          },
          `-=${180}`
        )
        .add(
          {
            targets: glowBars,
            rx: 5.5,
            height: 11,
            y: 78.5,
            duration: 180,
          },
          `-=${180}`
        );

      if (isDouble) {
        tl.add({
          targets: upperLids,
          height: 10.5,
          duration: 110,
          delay: 70,
        })
          .add(
            {
              targets: lowerLids,
              y: 85.5,
              height: 10.5,
              duration: 110,
            },
            `-=${110}`
          )
          .add(
            {
              targets: glowBars,
              rx: 2,
              height: 3.6,
              y: 82.2,
              duration: 110,
            },
            `-=${110}`
          )
          .add({
            targets: upperLids,
            height: 0,
            duration: 160,
            delay: 50,
          })
          .add(
            {
              targets: lowerLids,
              y: 96,
              height: 0,
              duration: 160,
            },
            `-=${160}`
          )
          .add(
            {
              targets: glowBars,
              rx: 5.5,
              height: 11,
              y: 78.5,
              duration: 160,
            },
            `-=${160}`
          );
      }
    };

    timer = setTimeout(triggerBlink, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mounted]);

  // 3. Eye gaze tracking toward cursor using anime.js
  useEffect(() => {
    if (!mounted) return;
    const onPointerMove = (e: PointerEvent) => {
      if (!visorGazeRef.current) return;
      const botCenterX = posRef.current.x + BOT_WIDTH / 2;
      const botCenterY = posRef.current.y + BOT_HEIGHT / 2;
      const dx = e.clientX - botCenterX;
      const dy = e.clientY - botCenterY;
      const dist = Math.hypot(dx, dy) || 1;
      const maxOffset = 3;
      const factor = Math.min(dist / 240, 1);
      const tx = (dx / dist) * maxOffset * factor;
      const ty = (dy / dist) * maxOffset * factor;

      anime({
        targets: visorGazeRef.current,
        translateX: tx,
        translateY: ty,
        duration: 220,
        easing: "easeOutQuad",
      });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [mounted]);

  // 4. AssistiveTouch Drag & Magnetic Edge Snap
  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    snapAnimRef.current?.pause();
    resetIdleTimer();

    const handle = handleButtonRef.current;
    const draggable = botContainerRef.current;
    if (!handle || !draggable) return;

    const rect = draggable.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };

    handle.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const handle = handleButtonRef.current;
    if (!handle || !handle.hasPointerCapture(event.pointerId)) return;

    const dx = event.clientX - dragStateRef.current.startX;
    const dy = event.clientY - dragStateRef.current.startY;

    if (!dragStateRef.current.moved && Math.hypot(dx, dy) < 6) {
      return;
    }

    if (!dragStateRef.current.moved) {
      dragStateRef.current.moved = true;
      isDraggingRef.current = true;
      setIsDragging(true);
      setIsIdleDimmed(false);

      if (floatWrapRef.current) {
        anime({
          targets: floatWrapRef.current,
          scale: 1.1,
          duration: 140,
          easing: "easeOutQuad",
        });
      }
    }

    moveTo(
      event.clientX - dragStateRef.current.offsetX,
      event.clientY - dragStateRef.current.offsetY,
      false
    );
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const handle = handleButtonRef.current;
    if (handle && handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }

    const wasDragged = dragStateRef.current.moved;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (wasDragged) {
      if (floatWrapRef.current) {
        anime({
          targets: floatWrapRef.current,
          scale: 1,
          rotate: 0,
          duration: 300,
          easing: "easeOutQuad",
        });
      }
      snapToNearestEdge(posRef.current.x, posRef.current.y);
    } else {
      if (loading && isOpen) {
        handleInteractiveThinkingPoke();
      } else {
        if (floatWrapRef.current) {
          anime({
            targets: floatWrapRef.current,
            scale: [
              { value: 0.9, duration: 80, easing: "easeInQuad" },
              { value: 1.07, duration: 150, easing: "easeOutQuad" },
              { value: 1, duration: 300, easing: "easeOutElastic(1, .5)" },
            ],
          });
        }
        setIsOpen((prev) => {
          const next = !prev;
          if (!next) resetIdleTimer();
          return next;
        });
      }
    }

    dragStateRef.current.pointerId = null;
  };

  const handleLostPointerCapture = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (floatWrapRef.current) {
        anime({
          targets: floatWrapRef.current,
          scale: 1,
          rotate: 0,
          duration: 300,
          easing: "easeOutQuad",
        });
      }
      snapToNearestEdge(posRef.current.x, posRef.current.y);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    resetIdleTimer();
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (loading && isOpen) {
        handleInteractiveThinkingPoke();
      } else {
        setIsOpen((prev) => !prev);
      }
      return;
    }

    const step = 20;
    let nextX = posRef.current.x;
    let nextY = posRef.current.y;
    let directionLabel = "";

    switch (event.key) {
      case "ArrowLeft":
        nextX -= step;
        directionLabel = "left";
        break;
      case "ArrowRight":
        nextX += step;
        directionLabel = "right";
        break;
      case "ArrowUp":
        nextY -= step;
        directionLabel = "up";
        break;
      case "ArrowDown":
        nextY += step;
        directionLabel = "down";
        break;
      default:
        return;
    }

    event.preventDefault();
    snapAnimRef.current?.pause();
    moveTo(nextX, nextY, true);
    announceMove(directionLabel);
  };

  // Send AI Chat Message (Gemini 2.5 Flash + Fast Markdown)
  const handleSendPrompt = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    const startedAt = performance.now();

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: selectedBook?.id,
          bookTitle: selectedBook?.title,
          author: selectedBook?.author,
          message: text.trim(),
          model: DEFAULT_GEMINI_MODEL,
          fastMode: true,
        }),
      });
      const d = await res.json();
      const elapsedMs = Math.max(120, Math.round(performance.now() - startedAt));
      const replyText =
        d.reply ||
        d.answer ||
        `### ⚡ eMax Insights for "${selectedBook?.title || "Your Library"}"\n\n• **Core Concept:** Synthesized key points from your reading session.\n• **Study Tip:** Ask **eMax** to generate flashcards or quiz questions on any chapter!`;

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: "assistant",
          content: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          latencyMs: elapsedMs,
          isTyping: true,
        },
      ]);
    } catch {
      const elapsedMs = Math.max(120, Math.round(performance.now() - startedAt));
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: "assistant",
          content: `### ⚡ eMax Study Notes for "${text.trim()}"\n\n1. **Core Takeaway:** Key principles extracted from your reading metadata.\n2. **Next Step:** Attach a book above for direct page citations.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          latencyMs: elapsedMs,
          isTyping: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendPrompt(input);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Markdown response copied!", "success");
  };

  if (!mounted) return null;

  // Clamped chat modal coordinates so it NEVER overflows off-screen
  const panelWidth = Math.min(370, viewport.w - 24);
  const panelHeight = Math.min(490, viewport.h - 100);
  const preferLeft = pos.x + BOT_WIDTH / 2 > viewport.w / 2;
  const rawPanelLeft = preferLeft ? pos.x - panelWidth - 14 : pos.x + BOT_WIDTH + 14;
  const panelLeft = Math.max(12, Math.min(viewport.w - panelWidth - 12, rawPanelLeft));

  const preferAbove = pos.y + BOT_HEIGHT / 2 > viewport.h / 2;
  const rawPanelTop = preferAbove ? pos.y + BOT_HEIGHT - panelHeight : pos.y;
  const panelTop = Math.max(12, Math.min(viewport.h - panelHeight - 16, rawPanelTop));

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </div>

      {/* eMax Floating AI Chat Modal — Clean Single-Row Top Header & Strictly Aligned Markdown */}
      {isOpen && !isDragging && (
        <div
          style={{
            position: "fixed",
            left: `${panelLeft}px`,
            top: `${panelTop}px`,
            width: `${panelWidth}px`,
            height: `${panelHeight}px`,
            zIndex: 65,
          }}
          className="flex flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/95 shadow-[0_20px_50px_rgba(5,5,20,0.85)] backdrop-blur-2xl animate-scale-in"
        >
          {/* Clean Minimal Single-Row Top Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <EMaxMiniAvatar
                size={32}
                state={loading ? "thinking" : isResponding ? "responding" : "idle"}
                onClick={loading ? handleInteractiveThinkingPoke : undefined}
              />
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-black tracking-tight text-white">
                    eMax
                  </h2>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
                <p className="truncate text-[10px] font-medium text-slate-400">
                  {loading
                    ? thinkingReaction || "Thinking..."
                    : isResponding
                    ? "Responding..."
                    : "AI Study Companion"}
                </p>
              </div>
            </div>

            {/* Clean Top-Right Actions: Clear Chat, Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  title="Clear Chat"
                  className="rounded-xl bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:bg-white/15 hover:text-white"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  resetIdleTimer();
                }}
                aria-label="Close eMax AI chat"
                className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <XIcon size={16} />
              </button>
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto space-y-3.5 p-4">
            {messages.length === 0 && !loading && (
              <div className="flex h-full flex-col items-center justify-center text-center space-y-3.5 py-4">
                <EMaxMiniAvatar size={48} state="idle" />
                <div className="space-y-1 px-3">
                  <p className="text-sm font-black text-white">
                    Hi, I&apos;m <span className="text-purple-300">eMax</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Ask me anything about your books, summaries, or key terms.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendPrompt(
                        `Summarize the core takeaways of "${
                          selectedBook?.title || "this book"
                        }"`
                      )
                    }
                    className="rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition-colors hover:border-purple-500/50 hover:text-white"
                  >
                    ⚡ Summarize
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendPrompt(
                        `Explain key technical terms in "${
                          selectedBook?.title || "this book"
                        }"`
                      )
                    }
                    className="rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition-colors hover:border-purple-500/50 hover:text-white"
                  >
                    💡 Key Terms
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendPrompt(
                        `Generate a 3-question quiz for "${
                          selectedBook?.title || "this book"
                        }"`
                      )
                    }
                    className="rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition-colors hover:border-purple-500/50 hover:text-white"
                  >
                    ❓ Quiz Me
                  </button>
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <ChatBubble
                key={m.id}
                message={m}
                isLatest={idx === messages.length - 1}
                onCopy={copyToClipboard}
                onStreamingChange={
                  idx === messages.length - 1 ? setIsResponding : undefined
                }
              />
            ))}

            {loading && (
              <InteractiveThinkingCard
                stepIndex={thinkingStep}
                pokes={thinkingPokes}
                onPoke={handleInteractiveThinkingPoke}
              />
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Book Search Picker Drawer (Anchored directly above the input area) */}
          {showBookPicker && (
            <div className="border-t border-slate-800 bg-slate-900/95 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <SearchIcon
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search book title or author..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-8 py-1.5 text-xs font-medium text-white outline-none focus:border-purple-500"
                  />
                  {searching && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>
                {selectedBook && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBook(null);
                      setShowBookPicker(false);
                      showToast("Detached book context", "info");
                    }}
                    className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/15 px-2.5 py-1.5 text-[10px] font-bold text-rose-300 transition-colors hover:bg-rose-500/25 hover:text-white"
                  >
                    Clear Book
                  </button>
                )}
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {searchResults.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-slate-400">
                    No books found.
                  </p>
                ) : (
                  searchResults.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBook(b);
                        setShowBookPicker(false);
                        showToast(`eMax attached "${b.title}"`, "success");
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-slate-800"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-bold text-slate-100">
                          {b.title}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">
                          {b.author}
                        </p>
                      </div>
                      {selectedBook?.id === b.id && (
                        <CheckIcon size={14} className="text-purple-400 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Chat Input Form with Aligned Add / Clear Book Control Directly Above Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-white/10 bg-slate-950 px-3 pt-2.5 pb-3 space-y-2"
          >
            {/* Aligned Book Attachment Bar Above Input */}
            <div className="flex items-center justify-between gap-2">
              {selectedBook ? (
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-purple-500/35 bg-purple-500/15 pl-2.5 pr-1.5 py-1 text-[11px] font-bold text-purple-200">
                  <button
                    type="button"
                    onClick={() => setShowBookPicker((v) => !v)}
                    title={`Change attached book (${selectedBook.title})`}
                    className="inline-flex min-w-0 items-center gap-1.5 text-left hover:text-white"
                  >
                    <BookOpenIcon size={12} className="shrink-0 text-purple-300" />
                    <span className="truncate max-w-[230px]">
                      {selectedBook.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBook(null);
                      setShowBookPicker(false);
                      showToast("Cleared attached book", "info");
                    }}
                    title="Remove attached book"
                    aria-label="Remove attached book"
                    className="ml-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-purple-400/20 text-purple-200 transition-colors hover:bg-rose-500/80 hover:text-white"
                  >
                    <XIcon size={11} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBookPicker((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    showBookPicker
                      ? "border-purple-500/50 bg-purple-500/20 text-purple-200"
                      : "border-slate-800 bg-slate-900/90 text-slate-300 hover:border-purple-500/40 hover:text-white"
                  }`}
                >
                  <BookOpenIcon size={12} className="text-purple-400" />
                  <span>+ Add Book Context</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/95 pl-3.5 pr-1.5 py-1 transition-colors focus-within:border-purple-500">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedBook
                    ? `Ask eMax about "${selectedBook.title}"...`
                    : "Ask eMax anything..."
                }
                className="flex-1 bg-transparent py-1.5 text-xs text-white outline-none placeholder:text-slate-500"
              />
              <Button
                type="submit"
                size="sm"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:from-purple-500 hover:to-indigo-500"
              >
                {loading ? "..." : "Send"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* AssistiveTouch eMax Robot Container — No background, no text label */}
      <div
        ref={botContainerRef}
        style={{
          position: "fixed",
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${BOT_WIDTH}px`,
          height: `${BOT_HEIGHT}px`,
          zIndex: 70,
          opacity: isIdleDimmed && !isOpen && !isDragging && !loading ? 0.58 : 1,
          transition: isDragging ? "none" : "opacity 0.35s ease",
        }}
        onMouseEnter={() => {
          setIsIdleDimmed(false);
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        }}
        onMouseLeave={() => {
          resetIdleTimer();
        }}
      >
        {(loading || isResponding) && (
          <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-purple-400/50 bg-slate-950/90 px-2.5 py-0.5 text-[10px] font-black text-purple-200 shadow-lg backdrop-blur-md animate-bounce">
            {loading
              ? thinkingPokes > 0
                ? `⚡ Boost x${thinkingPokes}`
                : "🧠 Thinking..."
              : "✨ Responding..."}
          </div>
        )}

        <button
          ref={handleButtonRef}
          type="button"
          aria-label="eMax AssistiveTouch AI Companion. Drag anywhere and release to snap to screen edge, tap to chat with eMax."
          aria-expanded={isOpen}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onLostPointerCapture={handleLostPointerCapture}
          onKeyDown={handleKeyDown}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            margin: 0,
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          className="group relative flex h-full w-full items-center justify-center bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-full"
        >
          <div ref={floatWrapRef} className="h-full w-full">
            <svg
              viewBox="0 0 200 230"
              className="h-full w-full overflow-visible drop-shadow-[0_10px_18px_rgba(25,15,75,0.48)]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <radialGradient id="botEyeAura" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity="0.85" />
                  <stop offset="45%" stopColor="#9333ea" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="#3b0764" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="helmetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f5f3ff" />
                  <stop offset="65%" stopColor="#e4d9ff" />
                  <stop offset="100%" stopColor="#cbbaf9" />
                </linearGradient>

                <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#311f7a" />
                  <stop offset="100%" stopColor="#211359" />
                </linearGradient>

                <linearGradient id="blueAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="45%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>

              {loading && (
                <circle
                  ref={thinkingHaloRef}
                  cx="100"
                  cy="95"
                  r="70"
                  stroke="#c084fc"
                  strokeWidth="4"
                  fill="none"
                  opacity="0.6"
                />
              )}

              <g>
                {/* LEFT ARM */}
                <g ref={leftArmRef}>
                  <path
                    d="M62 128 C48 134, 40 148, 36 164 C44 170, 56 170, 62 162 C66 150, 68 138, 62 128 Z"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M44 146 Q53 151 63 148"
                    stroke="#211359"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M39 157 Q49 162 60 159"
                    stroke="#211359"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <ellipse
                    cx="44"
                    cy="171"
                    rx="13"
                    ry="12"
                    transform="rotate(-15 44 171)"
                    fill="url(#suitGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.5"
                  />
                </g>

                {/* RIGHT ARM */}
                <g ref={rightArmRef}>
                  <path
                    d="M138 128 C152 134, 160 148, 164 164 C156 170, 144 170, 138 162 C134 150, 132 138, 138 128 Z"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M156 146 Q147 151 137 148"
                    stroke="#211359"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M161 157 Q151 162 140 159"
                    stroke="#211359"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <ellipse
                    cx="156"
                    cy="171"
                    rx="13"
                    ry="12"
                    transform="rotate(15 156 171)"
                    fill="url(#suitGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.5"
                  />
                </g>

                {/* LEFT BOOT */}
                <g ref={leftBootRef}>
                  <rect
                    x="60"
                    y="182"
                    width="34"
                    height="13"
                    rx="6"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.2"
                  />
                  <rect
                    x="57"
                    y="191"
                    width="38"
                    height="12"
                    rx="6"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.2"
                  />
                  <rect
                    x="54"
                    y="199"
                    width="42"
                    height="15"
                    rx="7.5"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.5"
                  />
                  <path
                    d="M57 209 H93"
                    stroke="#a78bfa"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </g>

                {/* RIGHT BOOT */}
                <g ref={rightBootRef}>
                  <rect
                    x="106"
                    y="182"
                    width="34"
                    height="13"
                    rx="6"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.2"
                  />
                  <rect
                    x="105"
                    y="191"
                    width="38"
                    height="12"
                    rx="6"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.2"
                  />
                  <rect
                    x="104"
                    y="199"
                    width="42"
                    height="15"
                    rx="7.5"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.5"
                  />
                  <path
                    d="M107 209 H143"
                    stroke="#a78bfa"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </g>

                {/* TORSO / SUIT */}
                <g>
                  <path
                    d="M64 126 C60 148, 58 172, 62 186 C70 190, 90 190, 100 183 C110 190, 130 190, 138 186 C142 172, 140 148, 136 126 Z"
                    fill="url(#suitGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M75 134 C73 156, 84 166, 100 166 C116 166, 127 156, 125 134 Z"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                </g>

                {/* BLUE NECK SCARF */}
                <g>
                  <path
                    d="M60 120 C75 129, 125 129, 140 120 L137 132 C118 144, 82 144, 63 132 Z"
                    fill="url(#blueAccentGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M72 128 Q100 136 128 127"
                    stroke="#1e3a8a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </g>

                {/* HEAD & HELMET */}
                <g ref={headGroupRef}>
                  <ellipse
                    cx="100"
                    cy="68"
                    rx="58"
                    ry="52"
                    fill="#191240"
                    stroke="#0d0b26"
                    strokeWidth="4.5"
                  />

                  <path
                    d="M44 56 C48 40, 58 28, 74 22 L80 34 C66 40, 56 50, 52 64 Z"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M57 31 L66 41"
                    stroke="#0d0b26"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M47 45 L58 52"
                    stroke="#0d0b26"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />

                  <path
                    d="M156 56 C152 40, 142 28, 126 22 L120 34 C134 40, 144 50, 148 64 Z"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M143 31 L134 41"
                    stroke="#0d0b26"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M153 45 L142 52"
                    stroke="#0d0b26"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />

                  <rect
                    x="43"
                    y="33"
                    width="114"
                    height="92"
                    rx="42"
                    fill="url(#helmetGrad)"
                    stroke="#0d0b26"
                    strokeWidth="4.8"
                  />

                  {/* Left Ear-Pod */}
                  <g>
                    <rect
                      x="27"
                      y="58"
                      width="24"
                      height="52"
                      rx="12"
                      fill="url(#helmetGrad)"
                      stroke="#0d0b26"
                      strokeWidth="4.5"
                    />
                    <ellipse
                      cx="35"
                      cy="84"
                      rx="6"
                      ry="17"
                      fill="#ffffff"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                    />
                    <ellipse
                      cx="33"
                      cy="84"
                      rx="3.5"
                      ry="10"
                      fill="url(#blueAccentGrad)"
                    />
                  </g>

                  {/* Right Ear-Pod */}
                  <g>
                    <rect
                      x="149"
                      y="58"
                      width="24"
                      height="52"
                      rx="12"
                      fill="url(#helmetGrad)"
                      stroke="#0d0b26"
                      strokeWidth="4.5"
                    />
                    <ellipse
                      cx="165"
                      cy="84"
                      rx="6"
                      ry="17"
                      fill="#ffffff"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                    />
                    <ellipse
                      cx="167"
                      cy="84"
                      rx="3.5"
                      ry="10"
                      fill="url(#blueAccentGrad)"
                    />
                  </g>

                  <g ref={earGlowRef}>
                    <ellipse
                      cx="33"
                      cy="84"
                      rx="4.5"
                      ry="12"
                      fill="#60a5fa"
                      opacity="0.45"
                    />
                    <ellipse
                      cx="167"
                      cy="84"
                      rx="4.5"
                      ry="12"
                      fill="#60a5fa"
                      opacity="0.45"
                    />
                  </g>

                  {/* Dark Space Visor Screen */}
                  <rect
                    x="56"
                    y="48"
                    width="88"
                    height="65"
                    rx="28"
                    fill="#0b102d"
                    stroke="#0d0b26"
                    strokeWidth="4.8"
                  />

                  {/* Top Segmented Forehead Crest */}
                  <g>
                    <rect
                      x="84"
                      y="15"
                      width="32"
                      height="18"
                      rx="6"
                      fill="url(#helmetGrad)"
                      stroke="#0d0b26"
                      strokeWidth="4.2"
                    />
                    <rect
                      x="86"
                      y="29"
                      width="28"
                      height="16"
                      rx="5"
                      fill="url(#helmetGrad)"
                      stroke="#2563eb"
                      strokeWidth="3.2"
                    />
                    <rect
                      x="89"
                      y="43"
                      width="22"
                      height="10"
                      rx="4"
                      fill="url(#helmetGrad)"
                      stroke="#0d0b26"
                      strokeWidth="3.5"
                    />
                  </g>

                  {/* VISOR EYES */}
                  <g ref={visorGazeRef}>
                    {/* LEFT EYE */}
                    <g>
                      <circle cx="80" cy="84" r="19" fill="url(#botEyeAura)" />
                      <rect
                        x="69"
                        y="75"
                        width="22"
                        height="18"
                        rx="9"
                        fill={loading ? "#38bdf8" : "#9333ea"}
                        opacity="0.8"
                      />
                      <rect
                        ref={leftEyeGlowBarRef}
                        x="71.5"
                        y="78.5"
                        width="17"
                        height="11"
                        rx="5.5"
                        fill={loading ? "#e0f2fe" : "#e9d5ff"}
                      />
                      <rect
                        ref={leftUpperLidRef}
                        x="66"
                        y="72"
                        width="28"
                        height="0"
                        fill="#0b102d"
                      />
                      <rect
                        ref={leftLowerLidRef}
                        x="66"
                        y="96"
                        width="28"
                        height="0"
                        fill="#0b102d"
                      />
                    </g>

                    {/* RIGHT EYE */}
                    <g>
                      <circle cx="120" cy="84" r="19" fill="url(#botEyeAura)" />
                      <rect
                        x="109"
                        y="75"
                        width="22"
                        height="18"
                        rx="9"
                        fill={loading ? "#38bdf8" : "#9333ea"}
                        opacity="0.8"
                      />
                      <rect
                        ref={rightEyeGlowBarRef}
                        x="111.5"
                        y="78.5"
                        width="17"
                        height="11"
                        rx="5.5"
                        fill={loading ? "#e0f2fe" : "#e9d5ff"}
                      />
                      <rect
                        ref={rightUpperLidRef}
                        x="106"
                        y="72"
                        width="28"
                        height="0"
                        fill="#0b102d"
                      />
                      <rect
                        ref={rightLowerLidRef}
                        x="106"
                        y="96"
                        width="28"
                        height="0"
                        fill="#0b102d"
                      />
                    </g>
                  </g>
                </g>
              </g>
            </svg>
          </div>
        </button>
      </div>
    </>
  );
}
