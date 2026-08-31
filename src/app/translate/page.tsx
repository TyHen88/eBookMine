"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import VerticalNav from "@/components/VerticalNav";
import GoogleTranslateModal from "@/components/GoogleTranslateModal";

export default function TranslatePage() {
  const [sourceText] = useState("");

  const [targetLang] = useState("km");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <Header />
      <VerticalNav />

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 pt-3 sm:pt-6 pb-28 md:pb-12 md:pl-24">
        {/* Only Google Translate Page */}
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
