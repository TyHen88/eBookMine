"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import GoogleTranslateModal from "@/components/GoogleTranslateModal";
import { SparklesIcon, TranslateIcon, VolumeIcon } from "@/components/ui/icons";

export default function TranslatePage() {
  const [sourceText] = useState("");
  const [targetLang] = useState("km");

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Header />

      <main className="mx-auto w-full max-w-[1380px] flex-1 space-y-5 px-4 sm:px-6 pt-4 sm:pt-6 pb-28 md:pb-14 md:pl-24 md:pr-10 animate-fade-in">
        {/* Translate Workspace Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-600 via-indigo-600 to-slate-900 p-5 sm:p-6 text-white shadow-xl shadow-brand-600/15 dark:border-brand-500/25">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
                  <TranslateIcon size={12} className="text-sky-300" />
                  <span>Neural Language Studio</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Khmer & 18+ Languages
                </span>
              </div>

              <h1 className="font-black tracking-tight text-white [font-size:clamp(1.35rem,1.05rem+1.2vw,2rem)] leading-tight">
                eBookMine AI Translate
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-brand-100/90">
                Translate passages between English, Khmer (ភាសាខ្មែរ), and 18+ languages with native text-to-speech and bilingual AI grammar explanations.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2 shrink-0">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/30 px-3.5 py-2 text-xs font-semibold text-brand-100 backdrop-blur-md">
                <VolumeIcon size={14} className="text-sky-300" />
                <span>Native Audio Pronunciation</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/30 px-3.5 py-2 text-xs font-semibold text-brand-100 backdrop-blur-md">
                <SparklesIcon size={14} className="text-amber-300" />
                <span>AI Contextual Breakdown</span>
              </div>
            </div>
          </div>
        </section>

        {/* Embedded Translate Studio */}
        <div className="w-full">
          <GoogleTranslateModal
            initialText={sourceText}
            initialTargetLang={targetLang}
            isEmbed={true}
          />
        </div>
      </main>
    </div>
  );
}
