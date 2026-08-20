"use client";

import React, { useEffect, useState } from "react";
import {
  UploadCloudIcon,
  CheckIcon,
  AlertTriangleIcon,
  RefreshIcon,
  BookOpenIcon,
} from "./ui/icons";

export interface SyncResultStats {
  total?: number;
  synced?: number;
  created?: number;
  updated?: number;
  errors?: string[];
}

export interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinished?: () => void;
}

export default function SyncProgressModal({
  isOpen,
  onClose,
  onFinished,
}: SyncProgressModalProps) {
  const [stage, setStage] = useState<"idle" | "connecting" | "scanning" | "saving" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Preparing synchronization...");
  const [stats, setStats] = useState<SyncResultStats | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function runSync() {
      try {
        setStage("connecting");
        setProgress(15);
        setStatusText("Connecting to Google Drive storage...");
        await new Promise((r) => setTimeout(r, 400));

        if (!isMounted) return;
        setStage("scanning");
        setProgress(45);
        setStatusText("Scanning PDF documents and metadata in Drive folder...");
        await new Promise((r) => setTimeout(r, 600));

        if (!isMounted) return;
        setStage("saving");
        setProgress(75);
        setStatusText("Ingesting and inserting book records into PostgreSQL...");

        const res = await fetch("/api/books/sync", { method: "POST" });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Google Drive synchronization failed");
        }

        if (!isMounted) return;
        setProgress(100);
        setStage("done");
        setStats(data.stats || { created: 0, synced: 0 });
        setStatusText("Synchronization complete!");

        const timer = setTimeout(() => {
          if (isMounted) {
            onFinished?.();
            onClose();
          }
        }, 2200);

        return () => clearTimeout(timer);
      } catch (err: any) {
        if (!isMounted) return;
        setStage("error");
        setProgress(100);
        setErrorMessage(err?.message || "An unexpected error occurred during sync");
      }
    }

    runSync();

    return () => {
      isMounted = false;
    };
  }, [isOpen, onClose, onFinished]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Dark Ambient Backdrop Blur */}
      <div
        onClick={() => {
          if (stage === "done" || stage === "error") onClose();
        }}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-fade-in"
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 dark:border-slate-800/90 dark:bg-slate-900/95 animate-scale-in">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-brand-500/20 blur-2xl pointer-events-none" />

        {/* Central Graphic */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
            {/* Ambient Radial Pulsing Glow */}
            <div
              className={`absolute -inset-2 rounded-full blur-xl transition-all duration-700 ${
                stage === "done"
                  ? "bg-emerald-500/30"
                  : stage === "error"
                  ? "bg-red-500/30"
                  : "bg-brand-500/30 animate-sync-glow"
              }`}
            />

            {/* Concentric Rotating Spinner Ring (Perfect Circular) */}
            {(stage === "connecting" || stage === "scanning" || stage === "saving") && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
                <div className="absolute inset-1.5 rounded-full border border-indigo-400/20 border-b-indigo-400 animate-spin [animation-direction:reverse] [animation-duration:2.5s]" />
              </>
            )}

            {/* Inner Icon Card with Subtle Floating Effect */}
            <div
              className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500 shadow-xl ${
                stage === "done"
                  ? "bg-emerald-500 text-white shadow-emerald-500/30 scale-105"
                  : stage === "error"
                  ? "bg-red-500 text-white shadow-red-500/30 scale-105"
                  : "bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-brand-500/40 animate-sync-float"
              }`}
            >
              {stage === "done" ? (
                <CheckIcon size={26} />
              ) : stage === "error" ? (
                <AlertTriangleIcon size={24} />
              ) : (
                <UploadCloudIcon size={24} />
              )}
            </div>
          </div>

          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            {stage === "done"
              ? "Library Up to Date"
              : stage === "error"
              ? "Sync Failed"
              : "Synchronizing Google Drive"}
          </h3>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs transition-all duration-300">
            {statusText}
          </p>

          {/* Smooth Progress Bar */}
          <div className="mt-5 w-full space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
              <div
                style={{ width: `${progress}%` }}
                className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${
                  stage === "done"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : stage === "error"
                    ? "bg-red-500"
                    : "bg-gradient-to-r from-brand-600 via-indigo-400 to-brand-600 animate-shimmer"
                }`}
              />
            </div>
          </div>

          {/* Step Timeline Indicator */}
          <div className="mt-5 w-full space-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-left text-xs dark:border-slate-800/80 dark:bg-slate-950/50">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold transition-colors ${
                  stage !== "idle"
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                ✓
              </span>
              <span
                className={`font-semibold ${
                  stage === "connecting"
                    ? "text-brand-600 dark:text-brand-400 font-bold"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                Connect to Google Drive Storage
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold transition-colors ${
                  stage === "saving" || stage === "done"
                    ? "bg-emerald-500 text-white"
                    : stage === "scanning"
                    ? "bg-brand-600 text-white animate-pulse"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {stage === "saving" || stage === "done" ? "✓" : "2"}
              </span>
              <span
                className={`font-semibold ${
                  stage === "scanning"
                    ? "text-brand-600 dark:text-brand-400 font-bold"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                Discover PDF Documents & Files
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold transition-colors ${
                  stage === "done"
                    ? "bg-emerald-500 text-white"
                    : stage === "saving"
                    ? "bg-brand-600 text-white animate-pulse"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {stage === "done" ? "✓" : "3"}
              </span>
              <span
                className={`font-semibold ${
                  stage === "saving"
                    ? "text-brand-600 dark:text-brand-400 font-bold"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                Upsert Records to Neon PostgreSQL
              </span>
            </div>
          </div>

          {/* Sync Stats Summary (On Success) */}
          {stage === "done" && stats && (
            <div className="mt-4 flex w-full items-center justify-around rounded-2xl bg-emerald-50/80 p-3 text-center text-xs dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 animate-fade-in">
              <div>
                <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  +{stats.created ?? 0}
                </div>
                <div className="text-[10px] font-semibold text-emerald-800/80 dark:text-emerald-300/80 uppercase tracking-wider">
                  New Books Added
                </div>
              </div>

              <div className="h-6 w-px bg-emerald-300/60 dark:bg-emerald-800/60" />

              <div>
                <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {stats.synced ?? 0}
                </div>
                <div className="text-[10px] font-semibold text-emerald-800/80 dark:text-emerald-300/80 uppercase tracking-wider">
                  Total Verified
                </div>
              </div>
            </div>
          )}

          {/* Error Details */}
          {stage === "error" && errorMessage && (
            <div className="mt-4 w-full rounded-2xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-5 flex w-full items-center justify-end gap-2">
            {stage === "error" ? (
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 transition active:scale-95"
              >
                Close
              </button>
            ) : stage === "done" ? (
              <button
                onClick={() => {
                  onFinished?.();
                  onClose();
                }}
                className="w-full rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-500/20 hover:bg-brand-700 transition active:scale-95"
              >
                Done
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
