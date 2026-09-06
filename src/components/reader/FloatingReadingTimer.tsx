"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ClockIcon,
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  Minimize2Icon,
  Maximize2Icon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
  SparklesIcon,
  PlusIcon,
  MinusIcon,
} from "@/components/ui/icons";

export type TimerStyle = "flip" | "gradient" | "orbit" | "amber";
export type TimerMode = "stopwatch" | "countdown";

interface FloatingReadingTimerProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "light" | "dark" | "sepia";
  bookTitle?: string;
  currentPage?: number;
}

// In-memory fallback if localStorage quota is exceeded or disabled
const memoryFallbackStore = new Map<string, string>();

function safeSetStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Silently fall back to in-memory store so quota errors NEVER disrupt Next.js dev server or UI
    memoryFallbackStore.set(key, value);
  }
}

function safeGetStorage(key: string): string | null {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
  } catch {
    // Ignore storage restriction errors
  }
  return memoryFallbackStore.get(key) ?? null;
}

// Play a relaxing, peaceful Tibetan singing bowl chime with Web Audio API
function playPeacefulChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Warm multi-harmonic fundamental frequencies (528Hz Solfeggio / Zen bell)
    const freqs = [528, 792, 1056, 1584];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const attack = 0.02 + idx * 0.01;
      const decay = 2.4 - idx * 0.4;

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25 / (idx + 1), ctx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + decay);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + decay + 0.1);
    });
  } catch (err) {
    console.warn("Audio chime not supported or blocked:", err);
  }
}

export default function FloatingReadingTimer({
  isOpen,
  onClose,
  theme = "light",
}: FloatingReadingTimerProps) {
  // Config & Preference State loaded synchronously via lazy initializers
  const [timerStyle, setTimerStyle] = useState<TimerStyle>(() => {
    if (typeof window === "undefined") return "flip";
    const saved = safeGetStorage("ebookmine_timer_style") as TimerStyle;
    if (saved && ["flip", "gradient", "orbit", "amber"].includes(saved)) return saved;
    return "flip";
  });

  const [timerMode, setTimerMode] = useState<TimerMode>(() => {
    if (typeof window === "undefined") return "countdown";
    const saved = safeGetStorage("ebookmine_timer_mode") as TimerMode;
    if (saved && ["stopwatch", "countdown"].includes(saved)) return saved;
    return "countdown";
  });

  const [targetMinutes, setTargetMinutes] = useState<number>(() => {
    if (typeof window === "undefined") return 15;
    const saved = safeGetStorage("ebookmine_timer_target");
    if (saved) {
      const mins = parseInt(saved, 10);
      if (!Number.isNaN(mins) && mins > 0) return mins;
    }
    return 15;
  });

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = safeGetStorage("ebookmine_timer_sound");
    if (saved !== null) return saved === "true";
    return true;
  });

  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isGoalReached, setIsGoalReached] = useState<boolean>(false);

  // Manual Custom Time Setting State
  const [isManualInputOpen, setIsManualInputOpen] = useState<boolean>(false);
  const [manualInputMinutes, setManualInputMinutes] = useState<string>(() => String(targetMinutes));

  // Timer Core State (in seconds)
  const [seconds, setSeconds] = useState<number>(() => {
    if (typeof window === "undefined") return 15 * 60;
    const savedMode = safeGetStorage("ebookmine_timer_mode");
    if (savedMode === "stopwatch") return 0;
    const savedTarget = safeGetStorage("ebookmine_timer_target");
    if (savedTarget) {
      const mins = parseInt(savedTarget, 10);
      if (!Number.isNaN(mins) && mins > 0) return mins * 60;
    }
    return 15 * 60;
  });
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Position & High-Performance Drag State
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 24, y: 72 };
    try {
      const savedPos = safeGetStorage("ebookmine_timer_pos");
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          return {
            x: Math.min(Math.max(8, parsed.x), window.innerWidth - 180),
            y: Math.min(Math.max(50, parsed.y), window.innerHeight - 100),
          };
        }
      }
      return { x: Math.max(16, window.innerWidth - 360), y: 68 };
    } catch {
      return { x: 24, y: 72 };
    }
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 24,
    posY: 72,
  });
  const currentPosRef = useRef<{ x: number; y: number }>(position);

  const cardRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Save changes to localStorage safely
  const updateStyle = (style: TimerStyle) => {
    setTimerStyle(style);
    safeSetStorage("ebookmine_timer_style", style);
  };

  const updateMode = (mode: TimerMode) => {
    setTimerMode(mode);
    safeSetStorage("ebookmine_timer_mode", mode);
    setIsRunning(false);
    setIsGoalReached(false);
    if (mode === "countdown") {
      setSeconds(targetMinutes * 60);
    } else {
      setSeconds(0);
    }
  };

  const updateTargetMinutes = (mins: number) => {
    setTargetMinutes(mins);
    setManualInputMinutes(String(mins));
    safeSetStorage("ebookmine_timer_target", String(mins));
    if (timerMode === "countdown") {
      setIsRunning(false);
      setIsGoalReached(false);
      setSeconds(mins * 60);
    }
  };

  // Adjust time manually on the fly (+/- seconds)
  const adjustSeconds = (deltaSeconds: number) => {
    setSeconds((prev) => {
      const next = Math.max(0, prev + deltaSeconds);
      if (timerMode === "countdown") {
        if (next === 0) {
          setIsRunning(false);
          setIsGoalReached(true);
          if (isSoundEnabled) playPeacefulChime();
        } else {
          setIsGoalReached(false);
        }
      }
      return next;
    });
  };

  // Apply custom manual minutes input
  const handleApplyManualMinutes = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(manualInputMinutes, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      updateTargetMinutes(parsed);
      setIsManualInputOpen(false);
    }
  };

  // Timer Tick Engine
  useEffect(() => {
    if (isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (timerMode === "countdown") {
            if (prev <= 1) {
              // Goal reached!
              setIsRunning(false);
              setIsGoalReached(true);
              if (isSoundEnabled) {
                playPeacefulChime();
              }
              return 0;
            }
            return prev - 1;
          } else {
            // Stopwatch mode: count up
            return prev + 1;
          }
        });
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRunning, timerMode, isSoundEnabled]);

  // Controls
  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isGoalReached && timerMode === "countdown") {
      setSeconds(targetMinutes * 60);
      setIsGoalReached(false);
    }
    setIsRunning((prev) => !prev);
  };

  const resetTimer = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsRunning(false);
    setIsGoalReached(false);
    if (timerMode === "countdown") {
      setSeconds(targetMinutes * 60);
    } else {
      setSeconds(0);
    }
  };

  // Silky Smooth GPU-Accelerated Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't start dragging if clicking interactive controls
    if (target.closest("button") || target.closest("input") || target.closest("form")) return;

    // Prevent default selection / drag ghosting
    e.preventDefault();

    isDraggingRef.current = true;
    setIsDragging(true);

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: currentPosRef.current.x,
      posY: currentPosRef.current.y,
    };
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;

      const newX = dragStartRef.current.posX + deltaX;
      const newY = dragStartRef.current.posY + deltaY;

      const cardWidth = isMinimized ? 220 : 360;
      const cardHeight = isMinimized ? 50 : 420;

      const maxX = Math.max(10, window.innerWidth - cardWidth);
      const maxY = Math.max(50, window.innerHeight - cardHeight);

      const clampedX = Math.max(8, Math.min(newX, maxX));
      const clampedY = Math.max(50, Math.min(newY, maxY));

      currentPosRef.current = { x: clampedX, y: clampedY };

      // Direct GPU transform update on DOM node: 100% lag-free and buttery smooth!
      if (cardRef.current) {
        cardRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
      }
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        setPosition(currentPosRef.current);
        safeSetStorage("ebookmine_timer_pos", JSON.stringify(currentPosRef.current));
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isMinimized]);

  if (!isOpen) return null;

  // Formatting helpers
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  const totalTargetSecs = targetMinutes * 60;
  const progressRatio =
    timerMode === "countdown"
      ? Math.max(0, Math.min(1, 1 - seconds / (totalTargetSecs || 1)))
      : Math.min(1, (seconds % 3600) / 3600);

  // Background Theme Card Styling
  const themeCardClass =
    theme === "sepia"
      ? "bg-[#faf6ed]/95 border-[#dcd0b8] text-[#3f3120] shadow-[#2d2215]/20"
      : theme === "dark"
      ? "bg-slate-900/95 border-slate-700/70 text-slate-100 shadow-black/60"
      : "bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-900/15";

  // =========================================================================
  // MINIMIZED VIEW - Dedicated Aesthetic for each Timer Style
  // =========================================================================
  if (isMinimized) {
    return (
      <div
        ref={cardRef}
        style={
          isDragging
            ? { left: 0, top: 0 }
            : {
                transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                left: 0,
                top: 0,
              }
        }
        onPointerDown={handlePointerDown}
        className={`fixed z-50 select-none will-change-transform touch-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Style 1 Minimized: Retro Dark Flip Capsule */}
        {timerStyle === "flip" && (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#16171a]/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl text-white">
            {/* Two miniature flip tiles */}
            <div className="flex items-center gap-1 font-mono">
              <div className="relative h-8 w-7 sm:w-8 rounded-md bg-[#222327] border border-white/10 flex items-center justify-center text-xs font-black text-white shadow-inner overflow-hidden">
                <span>{pad(minutes)}</span>
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-black/90" />
              </div>
              <span className={`text-amber-500 text-xs font-black ${isRunning ? "animate-pulse" : ""}`}>:</span>
              <div className="relative h-8 w-7 sm:w-8 rounded-md bg-[#222327] border border-white/10 flex items-center justify-center text-xs font-black text-white shadow-inner overflow-hidden">
                <span>{pad(secs)}</span>
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-black/90" />
              </div>
            </div>

            <button
              type="button"
              onClick={togglePlay}
              className={`flex h-6 w-6 items-center justify-center rounded-full font-black text-slate-950 transition active:scale-90 ${
                isRunning ? "bg-amber-400 shadow-sm shadow-amber-400/40" : "bg-amber-500 hover:bg-amber-400"
              }`}
              title={isRunning ? "Pause" : "Start"}
            >
              {isRunning ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-white/15 hover:text-white transition"
              title="Expand Timer"
            >
              <Maximize2Icon size={12} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-red-950/60 hover:text-red-400 transition"
              title="Close Timer"
            >
              <XIcon size={12} />
            </button>
          </div>
        )}

        {/* Style 2 Minimized: Aura Gradient Ring Pill */}
        {timerStyle === "gradient" && (
          <div className="flex items-center gap-2 rounded-full border border-purple-500/40 bg-slate-900/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl text-white">
            <div className="relative flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90 transform" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="3" className="text-purple-950/60" />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 13}
                  strokeDashoffset={2 * Math.PI * 13 * (1 - progressRatio)}
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <span className="font-mono text-xs font-black tracking-tight text-purple-200">
              {hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`}
            </span>

            <button
              type="button"
              onClick={togglePlay}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm hover:brightness-110 active:scale-90 transition"
              title={isRunning ? "Pause" : "Start"}
            >
              {isRunning ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-white/15 hover:text-white transition"
              title="Expand Timer"
            >
              <Maximize2Icon size={12} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-red-950/60 hover:text-red-400 transition"
              title="Close Timer"
            >
              <XIcon size={12} />
            </button>
          </div>
        )}

        {/* Style 3 Minimized: Zen Orbit Pill */}
        {timerStyle === "orbit" && (
          <div className="flex items-center gap-2 rounded-full border border-indigo-500/40 bg-slate-900/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl text-white">
            <div className="relative flex items-center justify-center w-7 h-7">
              <svg className="w-7 h-7 -rotate-90 transform" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-800" />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2.5"
                  strokeDasharray={2 * Math.PI * 13}
                  strokeDashoffset={2 * Math.PI * 13 * (1 - progressRatio)}
                  strokeLinecap="round"
                />
              </svg>
              <div
                className="absolute w-2 h-2 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400"
                style={{
                  top: `${16 - 1 + 13 * Math.sin(progressRatio * 2 * Math.PI - Math.PI / 2)}px`,
                  left: `${16 - 1 + 13 * Math.cos(progressRatio * 2 * Math.PI - Math.PI / 2)}px`,
                }}
              />
            </div>

            <span className="font-mono text-xs font-black tracking-tight text-indigo-100">
              {hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`}
            </span>

            <button
              type="button"
              onClick={togglePlay}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 active:scale-90 transition"
              title={isRunning ? "Pause" : "Start"}
            >
              {isRunning ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-white/15 hover:text-white transition"
              title="Expand Timer"
            >
              <Maximize2Icon size={12} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-red-950/60 hover:text-red-400 transition"
              title="Close Timer"
            >
              <XIcon size={12} />
            </button>
          </div>
        )}

        {/* Style 4 Minimized: Cozy Amber Bookish Pill */}
        {timerStyle === "amber" && (
          <div className="flex items-center gap-2 rounded-full border border-amber-300/80 bg-[#faf5ec]/95 px-3 py-1.5 shadow-xl backdrop-blur-xl text-[#45321d]">
            <span className="font-mono text-xs font-black tracking-tight text-[#45321d]">
              {hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`}
            </span>

            <button
              type="button"
              onClick={togglePlay}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-white shadow-sm hover:bg-amber-500 active:scale-90 transition"
              title={isRunning ? "Pause" : "Start"}
            >
              {isRunning ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#7a5e3d] hover:bg-black/10 transition"
              title="Expand Timer"
            >
              <Maximize2Icon size={12} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#7a5e3d] hover:bg-red-100 hover:text-red-600 transition"
              title="Close Timer"
            >
              <XIcon size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // EXPANDED VIEW - Beautiful Floating Window
  // =========================================================================
  return (
    <div
      ref={cardRef}
      style={
        isDragging
          ? { left: 0, top: 0 }
          : {
              transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
              left: 0,
              top: 0,
            }
      }
      className={`fixed z-50 flex w-[330px] sm:w-[350px] flex-col rounded-3xl border shadow-2xl backdrop-blur-2xl select-none will-change-transform ${themeCardClass}`}
    >
      {/* Header / Smooth Drag Handle */}
      <div
        onPointerDown={handlePointerDown}
        className="flex h-11 w-full items-center justify-between border-b border-black/5 dark:border-white/10 px-4 py-2 cursor-grab active:cursor-grabbing touch-none"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-400/20 dark:text-brand-300">
            <ClockIcon size={14} />
          </span>
          <span className="text-xs font-extrabold tracking-wide">
            Reading Timer
          </span>
          {isRunning && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Audio Chime Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !isSoundEnabled;
              setIsSoundEnabled(next);
              safeSetStorage("ebookmine_timer_sound", String(next));
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              isSoundEnabled
                ? "text-brand-600 hover:bg-brand-500/10 dark:text-brand-300"
                : "text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
            title={isSoundEnabled ? "Chime enabled on finish" : "Chime muted"}
          >
            {isSoundEnabled ? <Volume2Icon size={14} /> : <VolumeXIcon size={14} />}
          </button>

          {/* Minimize Button */}
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 transition"
            title="Minimize to Floating Pill"
          >
            <Minimize2Icon size={14} />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition"
            title="Close Timer"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>

      {/* Main Timer Display Body */}
      <div className="flex flex-col items-center justify-center px-4 pt-4 pb-3">
        {/* Style Renderer Switch */}
        {timerStyle === "flip" && (
          <FlipClockDisplay
            hours={hours}
            minutes={minutes}
            seconds={secs}
            isRunning={isRunning}
          />
        )}

        {timerStyle === "gradient" && (
          <GradientRingDisplay
            hours={hours}
            minutes={minutes}
            seconds={secs}
            progress={progressRatio}
            isRunning={isRunning}
          />
        )}

        {timerStyle === "orbit" && (
          <OrbitRingDisplay
            hours={hours}
            minutes={minutes}
            seconds={secs}
            progress={progressRatio}
            isRunning={isRunning}
            subtitle={
              timerMode === "countdown"
                ? `${Math.max(1, Math.ceil(seconds / 60))}m left`
                : "Continuous Session"
            }
          />
        )}

        {timerStyle === "amber" && (
          <CozyAmberDisplay
            hours={hours}
            minutes={minutes}
            seconds={secs}
            progress={progressRatio}
            isRunning={isRunning}
          />
        )}

        {/* Goal Reached Celebration Banner */}
        {isGoalReached && (
          <div className="mt-3 flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/30 px-3 py-2 text-emerald-700 dark:text-emerald-300 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <SparklesIcon size={15} className="animate-spin text-emerald-500" />
              <span>Goal Completed! 🎉</span>
            </div>
            <button
              type="button"
              onClick={() => updateTargetMinutes(targetMinutes + 5)}
              className="rounded-lg bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-500 active:scale-95 transition"
            >
              +5 mins
            </button>
          </div>
        )}

        {/* Primary Play / Pause & Reset Controls */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={resetTimer}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 text-slate-500 hover:bg-black/10 hover:text-slate-800 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20 active:scale-95 transition"
            title="Reset Timer"
          >
            <RotateCcwIcon size={16} />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className={`flex h-11 items-center gap-2 rounded-2xl px-6 font-extrabold text-sm text-white shadow-lg active:scale-95 transition-all ${
              isRunning
                ? "bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30 hover:brightness-105"
                : "bg-gradient-to-r from-brand-600 to-indigo-600 shadow-brand-500/30 hover:brightness-105"
            }`}
          >
            {isRunning ? (
              <>
                <PauseIcon size={16} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <PlayIcon size={16} />
                <span>{seconds === 0 ? "Restart" : "Start"}</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Stepper Row: -5m, -1m, Manual, +1m, +5m */}
        <div className="mt-3 flex items-center justify-center gap-1 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => adjustSeconds(-300)}
            disabled={seconds <= 0}
            className="rounded-lg bg-black/5 dark:bg-white/10 px-2 py-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 active:scale-95 transition"
            title="Subtract 5 minutes"
          >
            -5m
          </button>
          <button
            type="button"
            onClick={() => adjustSeconds(-60)}
            disabled={seconds <= 0}
            className="rounded-lg bg-black/5 dark:bg-white/10 px-2 py-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 active:scale-95 transition"
            title="Subtract 1 minute"
          >
            -1m
          </button>
          <button
            type="button"
            onClick={() => setIsManualInputOpen((p) => !p)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold active:scale-95 transition ${
              isManualInputOpen
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-brand-500/10 text-brand-600 dark:bg-brand-400/20 dark:text-brand-300 hover:bg-brand-500/20"
            }`}
            title="Set custom manual time"
          >
            <span>Manual</span>
          </button>
          <button
            type="button"
            onClick={() => adjustSeconds(60)}
            className="rounded-lg bg-black/5 dark:bg-white/10 px-2 py-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 active:scale-95 transition"
            title="Add 1 minute"
          >
            +1m
          </button>
          <button
            type="button"
            onClick={() => adjustSeconds(300)}
            className="rounded-lg bg-black/5 dark:bg-white/10 px-2 py-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 active:scale-95 transition"
            title="Add 5 minutes"
          >
            +5m
          </button>
        </div>

        {/* Manual Direct Input Form */}
        {isManualInputOpen && (
          <form
            onSubmit={handleApplyManualMinutes}
            className="mt-3 flex w-full items-center justify-between gap-1.5 rounded-2xl border border-brand-500/30 bg-brand-50/80 dark:bg-brand-950/40 p-2 animate-fadeIn"
          >
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300 text-[11px]">
                Minutes:
              </span>
              <input
                type="number"
                min="1"
                max="720"
                value={manualInputMinutes}
                onChange={(e) => setManualInputMinutes(e.target.value)}
                className="h-7 w-16 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-black text-slate-900 dark:text-white shadow-inner outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-xs"
                placeholder="mins"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-3 py-1 text-[11px] font-extrabold text-white shadow-sm hover:bg-brand-500 active:scale-95 transition"
              >
                Set
              </button>
              <button
                type="button"
                onClick={() => setIsManualInputOpen(false)}
                className="rounded-lg px-2 py-1 text-[11px] font-bold text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer Config: Style Chooser, Mode & Target Presets */}
      <div className="border-t border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 rounded-b-3xl flex flex-col gap-2.5">
        {/* Row 1: Style Selector Chips */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            Style:
          </span>
          <div className="flex items-center gap-1 rounded-xl bg-black/5 p-0.5 dark:bg-white/10">
            <button
              type="button"
              onClick={() => updateStyle("flip")}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition ${
                timerStyle === "flip"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Retro Flip Clock (Image 1)"
            >
              Flip
            </button>
            <button
              type="button"
              onClick={() => updateStyle("gradient")}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition ${
                timerStyle === "gradient"
                  ? "bg-white text-purple-600 shadow-sm dark:bg-slate-800 dark:text-purple-300"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Purple Gradient Ring (Image 2)"
            >
              Aura
            </button>
            <button
              type="button"
              onClick={() => updateStyle("orbit")}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition ${
                timerStyle === "orbit"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Zen Orbit Dot (Image 3)"
            >
              Orbit
            </button>
            <button
              type="button"
              onClick={() => updateStyle("amber")}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition ${
                timerStyle === "amber"
                  ? "bg-[#ecdcc0] text-[#4f381c] shadow-sm font-black"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Cozy Amber Bookish"
            >
              Amber
            </button>
          </div>
        </div>

        {/* Row 2: Mode Selector */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-black/5 dark:border-white/10">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            Mode:
          </span>
          <div className="flex items-center rounded-xl bg-black/5 p-0.5 dark:bg-white/10 text-xs font-black">
            <button
              type="button"
              onClick={() => updateMode("countdown")}
              className={`rounded-lg px-3 py-1 transition ${
                timerMode === "countdown"
                  ? "bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Goal
            </button>
            <button
              type="button"
              onClick={() => updateMode("stopwatch")}
              className={`rounded-lg px-3 py-1 transition ${
                timerMode === "stopwatch"
                  ? "bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Stopwatch
            </button>
          </div>
        </div>

        {/* Row 3: Target Presets (when in Goal mode) - Full-width spacious row */}
        {timerMode === "countdown" && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {[15, 25, 30, 45].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateTargetMinutes(m)}
                className={`flex-1 rounded-xl py-1.5 text-xs font-black transition ${
                  targetMinutes === m && !isManualInputOpen
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-black/5 text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300"
                }`}
              >
                {m}m
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsManualInputOpen((p) => !p)}
              className={`flex-1 rounded-xl py-1.5 text-xs font-black transition ${
                ![15, 25, 30, 45].includes(targetMinutes) || isManualInputOpen
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-black/5 text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300"
              }`}
              title="Set manual duration"
            >
              {![15, 25, 30, 45].includes(targetMinutes) ? `${targetMinutes}m` : "Custom"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// STYLE 1: RETRO FLIP CLOCK (Exact match for Reference Image 1)
// Clean standalone dark split-flap tiles with seamless 50% split digits
// =========================================================================
function FlipCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [prevVal, setPrevVal] = useState(value);
  const [currentVal, setCurrentVal] = useState(value);

  // Official React pattern for adjusting state when props change
  if (value !== currentVal) {
    setPrevVal(currentVal);
    setCurrentVal(value);
  }

  const isFlipping = prevVal !== currentVal;

  return (
    <div className="flex flex-col items-center">
      {/* 3D Flip Card Container - Freestanding dark tile */}
      <div className="flip-clock-perspective relative h-32 w-28 sm:w-32 rounded-2xl shadow-2xl select-none">
        {/* Upper Static Half (Shows Current Top Half) */}
        <div className="absolute inset-x-0 top-0 h-16 overflow-hidden rounded-t-2xl bg-gradient-to-b from-[#2e2f34] via-[#242529] to-[#1c1d20] border-t border-x border-white/15 shadow-inner">
          <div className="absolute inset-x-0 top-0 h-32 flex items-center justify-center font-sans font-black text-6xl sm:text-7xl text-[#f5f5f7] tracking-tighter leading-none select-none drop-shadow-sm">
            {currentVal}
          </div>
          {/* Subtle top glare highlight */}
          <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        </div>

        {/* Lower Static Half (Shows Current Bottom Half) */}
        <div className="absolute inset-x-0 bottom-0 h-16 overflow-hidden rounded-b-2xl bg-gradient-to-b from-[#18191b] via-[#131416] to-[#0f1012] border-b border-x border-white/10 shadow-lg">
          <div className="absolute inset-x-0 -top-16 h-32 flex items-center justify-center font-sans font-black text-6xl sm:text-7xl text-[#e6e6e8] tracking-tighter leading-none select-none drop-shadow-sm">
            {currentVal}
          </div>
        </div>

        {/* Animated Upper Flap (Flips down from Previous) */}
        {isFlipping && (
          <div
            key={`top-${currentVal}`}
            className="flip-card-3d animate-flip-top absolute inset-x-0 top-0 h-16 overflow-hidden rounded-t-2xl bg-gradient-to-b from-[#2e2f34] via-[#242529] to-[#1c1d20] border-t border-x border-white/15 z-10 shadow-md"
          >
            <div className="absolute inset-x-0 top-0 h-32 flex items-center justify-center font-sans font-black text-6xl sm:text-7xl text-[#f5f5f7] tracking-tighter leading-none select-none drop-shadow-sm">
              {prevVal}
            </div>
          </div>
        )}

        {/* Animated Lower Flap (Flips in with Current) */}
        {isFlipping && (
          <div
            key={`bottom-${currentVal}`}
            className="flip-card-3d animate-flip-bottom absolute inset-x-0 bottom-0 h-16 overflow-hidden rounded-b-2xl bg-gradient-to-b from-[#18191b] via-[#131416] to-[#0f1012] border-b border-x border-white/10 z-10 shadow-lg"
          >
            <div className="absolute inset-x-0 -top-16 h-32 flex items-center justify-center font-sans font-black text-6xl sm:text-7xl text-[#e6e6e8] tracking-tighter leading-none select-none drop-shadow-sm">
              {currentVal}
            </div>
          </div>
        )}

        {/* Horizontal Mechanical Groove Seam */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-black/95 z-20 shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
      </div>

      {/* Amber Label Underneath like Reference Image 1 */}
      <span className="mt-2.5 text-xs font-black uppercase tracking-[0.25em] text-amber-500">
        {label}
      </span>
    </div>
  );
}

function FlipClockDisplay({
  hours,
  minutes,
  seconds,
  isRunning: _isRunning,
}: {
  hours: number;
  minutes: number;
  seconds: number;
  isRunning: boolean;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");

  const isLongSession = hours > 0;
  const leftVal = isLongSession ? pad(hours) : pad(minutes);
  const rightVal = isLongSession ? pad(minutes) : pad(seconds);
  const leftLabel = isLongSession ? "Hours" : "Minutes";
  const rightLabel = isLongSession ? "Minutes" : "Seconds";

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 py-3">
      <FlipCard value={leftVal} label={leftLabel} />
      <FlipCard value={rightVal} label={rightLabel} />
    </div>
  );
}

// =========================================================================
// STYLE 2: GRADIENT AURA RING (Inspired by Reference Image 2)
// Smooth circular purple/indigo gradient progress with bold center text
// =========================================================================
function GradientRingDisplay({
  hours,
  minutes,
  seconds,
  progress,
  isRunning,
}: {
  hours: number;
  minutes: number;
  seconds: number;
  progress: number;
  isRunning: boolean;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeText =
    hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center p-2">
      <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 130 130">
        <defs>
          <linearGradient id="auraGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="60%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Track Circle */}
        <circle
          cx="65"
          cy="65"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="11"
          className="text-purple-100/60 dark:text-purple-950/40"
        />

        {/* Animated Gradient Active Arc */}
        <circle
          cx="65"
          cy="65"
          r={radius}
          fill="none"
          stroke="url(#auraGradient)"
          strokeWidth="11"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          filter={isRunning ? "url(#glowFilter)" : undefined}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>

      {/* Center Digital Typography */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {timeText}
        </span>
        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
          {isRunning ? "Reading" : "Paused"}
        </span>
      </div>
    </div>
  );
}

// =========================================================================
// STYLE 3: ZEN ORBIT RING (Inspired by Reference Image 3)
// Clean minimalist circle with glowing indicator orb and subtitle
// =========================================================================
function OrbitRingDisplay({
  hours,
  minutes,
  seconds,
  progress,
  isRunning,
  subtitle,
}: {
  hours: number;
  minutes: number;
  seconds: number;
  progress: number;
  isRunning: boolean;
  subtitle: string;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeText =
    hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  // Calculate orbiting dot X & Y coordinate
  const angle = progress * 2 * Math.PI - Math.PI / 2;
  const dotX = 65 + radius * Math.cos(angle);
  const dotY = 65 + radius * Math.sin(angle);

  return (
    <div className="relative flex items-center justify-center p-2">
      <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 130 130">
        {/* Background Track */}
        <circle
          cx="65"
          cy="65"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-slate-200/80 dark:text-slate-800"
        />

        {/* Active Stroke */}
        <circle
          cx="65"
          cy="65"
          r={radius}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="4.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>

      {/* Orbit Indicator Dot / Handle */}
      <div
        className="absolute w-36 h-36 pointer-events-none"
        style={{ top: "8px", left: "8px" }}
      >
        <svg viewBox="0 0 130 130" className="w-full h-full overflow-visible">
          <circle
            cx={dotX}
            cy={dotY}
            r="7"
            fill="#4f46e5"
            fillOpacity="0.25"
            className={isRunning ? "animate-pulse" : ""}
          />
          <circle cx={dotX} cy={dotY} r="4" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {timeText}
        </span>
        <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

// =========================================================================
// STYLE 4: COZY AMBER BOOKISH THEME
// Warm parchment aesthetic designed for sepia & long night reads
// =========================================================================
function CozyAmberDisplay({
  hours,
  minutes,
  seconds,
  progress,
  isRunning,
}: {
  hours: number;
  minutes: number;
  seconds: number;
  progress: number;
  isRunning: boolean;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeText =
    hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center p-2">
      <div className="relative flex items-center justify-center rounded-full bg-gradient-to-br from-[#f5ede0] to-[#ebdcc2] dark:from-[#2e261d] dark:to-[#1f1912] p-2 shadow-inner border border-[#d8c7a6]/50">
        <svg className="w-32 h-32 -rotate-90 transform" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-amber-900/10 dark:text-amber-100/10"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#d97706"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono text-2xl font-black tracking-tight text-[#45321d] dark:text-amber-100">
            {timeText}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
            {isRunning ? "Focus Flow" : "Resting"}
          </span>
        </div>
      </div>
    </div>
  );
}
