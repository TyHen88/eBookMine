"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  XIcon,
  CopyIcon,
  CheckIcon,
  VolumeIcon,
  SwapIcon,
  GoogleTranslateLogo,
  SparklesIcon,
} from "./ui/icons";
import { containsKhmer } from "@/lib/khmerHelper";
import { AiMarkdownView } from "./ui";

export interface GoogleTranslateModalProps {
  initialText: string;
  initialTargetLang?: string;
  initialSourceLang?: string;
  theme?: "light" | "dark" | "sepia";
  isEmbed?: boolean;
  onClose?: () => void;
  onAskAi?: (text: string) => void;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const POPULAR_LANGUAGES: LanguageOption[] = [
  { code: "km", name: "Khmer", nativeName: "ភាសាខ្មែរ", flag: "🇰🇭" },
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "zh-CN", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
];

export const ALL_LANGUAGES: LanguageOption[] = [
  ...POPULAR_LANGUAGES,
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱" },
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩" },
];

export function renderAiExplanation(content: string | null) {
  if (!content) return null;
  return <AiMarkdownView content={content} />;
}

export default function GoogleTranslateModal({
  initialText,
  initialTargetLang = "km",
  initialSourceLang = "auto",
  theme = "light",
  isEmbed = false,
  onClose,
  onAskAi,
}: GoogleTranslateModalProps) {
  const [sourceText, setSourceText] = useState(initialText);
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState(initialSourceLang);
  const [targetLang, setTargetLang] = useState(initialTargetLang);
  const [detectedLangName, setDetectedLangName] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copiedSource, setCopiedSource] = useState(false);
  const [copiedTranslation, setCopiedTranslation] = useState(false);
  const [isSpeakingSource, setIsSpeakingSource] = useState(false);
  const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);

  const [swapRotate, setSwapRotate] = useState(0);


  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const handleExplainAi = async () => {
    if (onAskAi) {
      onAskAi(`Explain translation of "${sourceText.substring(0, 50)}" -> "${translatedText.substring(0, 50)}"`);
      if (onClose && !isEmbed) onClose();
      return;
    }

    if (!sourceText.trim()) return;

    setLoadingAi(true);
    setAiExplanation(null);
    try {
      const res = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "explain",
          text: sourceText,
          targetLang: targetLang,
        }),
      });
      const d = await res.json();
      setAiExplanation(d.result || d.error || "No explanation generated.");
    } catch {
      setAiExplanation("Could not generate AI explanation. Please try again.");
    } finally {
      setLoadingAi(false);
    }
  };

  // Fetch translation logic
  const performTranslation = async (textToTranslate: string, from: string, to: string) => {
    if (!textToTranslate.trim()) {
      setTranslatedText("");
      setDefinitions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToTranslate,
          from,
          to,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Translation request failed");

      setTranslatedText(data.translatedText || "");
      if (data.detectedSourceLangName) {
        setDetectedLangName(data.detectedSourceLangName);
      } else {
        setDetectedLangName(null);
      }
      setDefinitions(data.definitions || []);
    } catch (err: any) {
      setError(err.message || "Could not translate text.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performTranslation(sourceText, sourceLang, targetLang);
    }, 0);
    return () => clearTimeout(timer);
  }, [sourceLang, targetLang, sourceText]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setSourceText(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      performTranslation(val, sourceLang, targetLang);
    }, 400);
  };

  // Language Swap Handler
  const handleSwapLanguages = () => {
    setSwapRotate((prev) => prev + 180);
    const newSourceLang = targetLang === "auto" ? "en" : targetLang;
    const newTargetLang = sourceLang === "auto" ? "en" : sourceLang;
    const newSourceText = translatedText;
    const newTranslatedText = sourceText;

    setSourceLang(newSourceLang);
    setTargetLang(newTargetLang);
    setSourceText(newSourceText);
    setTranslatedText(newTranslatedText);

    if (newSourceText.trim()) {
      performTranslation(newSourceText, newSourceLang, newTargetLang);
    }
  };

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeakingSource(false);
    setIsSpeakingTarget(false);
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // Speech Audio Playback (Neural TTS + Khmer & Multilingual support)
  const speakText = (text: string, langCode: string, isSource: boolean) => {
    if (!text || !text.trim()) return;

    if (isSource ? isSpeakingSource : isSpeakingTarget) {
      stopAudio();
      return;
    }

    stopAudio();

    if (isSource) setIsSpeakingSource(true);
    else setIsSpeakingTarget(true);

    const isKhmerText = containsKhmer(text) || langCode === "km";
    const targetLangCode = isKhmerText ? "km" : langCode === "auto" ? "en" : langCode;

    // Use /api/tts endpoint for reliable Khmer pronunciation and long-text multi-chunk audio
    const ttsUrl = `/api/tts?text=${encodeURIComponent(text.slice(0, 1500))}&lang=${encodeURIComponent(targetLangCode)}`;
    const audio = new Audio(ttsUrl);
    activeAudioRef.current = audio;

    audio.onended = () => {
      stopAudio();
    };

    audio.onerror = () => {
      // NEVER fallback to browser SpeechSynthesis for Khmer (browsers default to English)
      if (!isKhmerText && typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          if (targetLangCode !== "auto") {
            utterance.lang = targetLangCode;
          }
          utterance.onend = () => stopAudio();
          utterance.onerror = () => stopAudio();
          window.speechSynthesis.speak(utterance);
          return;
        } catch {
          stopAudio();
        }
      }
      stopAudio();
    };

    audio.play().catch(() => {
      // Handle auto-play policy or fallback for non-Khmer languages
      if (!isKhmerText && typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          if (targetLangCode !== "auto") {
            utterance.lang = targetLangCode;
          }
          utterance.onend = () => stopAudio();
          utterance.onerror = () => stopAudio();
          window.speechSynthesis.speak(utterance);
          return;
        } catch {
          stopAudio();
        }
      }
      stopAudio();
    });
  };

  // Clipboard Copy
  const copyToClipboard = (text: string, isSource: boolean) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (isSource) {
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 2000);
    } else {
      setCopiedTranslation(true);
      setTimeout(() => setCopiedTranslation(false), 2000);
    }
  };

  // Theme Styles
  let bgModal = "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-2xl";
  let bgPanel = "bg-slate-50 dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800";
  let bgTargetPanel = "bg-brand-50/40 dark:bg-slate-900/90 border-brand-200/60 dark:border-brand-900/60";
  let borderDivider = "border-slate-200/80 dark:border-slate-800";

  if (theme === "dark") {
    bgModal = "bg-slate-900 text-slate-100 border-slate-800 shadow-2xl";
    bgPanel = "bg-slate-900/90 border-slate-800";
    bgTargetPanel = "bg-slate-900/90 border-brand-900/60";
    borderDivider = "border-slate-800";
  } else if (theme === "sepia") {
    bgModal = "bg-[#f4e4c1] text-[#5c4b37] border-[#e2cf9f] shadow-2xl";
    bgPanel = "bg-[#ebd9b3]/50 border-[#e2cf9f]";
    bgTargetPanel = "bg-[#ebd9b3]/80 border-[#e2cf9f]";
    borderDivider = "border-[#e2cf9f]";
  }

  // Parse dual-language AI explanation parts
  const expParts = aiExplanation ? aiExplanation.split("===SPLIT_LANG_EXPLANATION===") : [];
  const englishExp = expParts[0] ? expParts[0].trim() : "";
  const targetExp = expParts[1] ? expParts[1].trim() : "";
  const targetLangObj = ALL_LANGUAGES.find((l) => l.code === targetLang);

  const mainContent = (
    <div
      className={`relative w-full transition-all duration-300 flex flex-col font-khmer noto-sans-khmer ${
        isEmbed
          ? "bg-transparent text-slate-900 dark:text-slate-100"
          : `max-w-2xl max-h-[88vh] overflow-hidden rounded-2xl border ${bgModal} shadow-2xl`
      }`}
    >

      {/* Top Header Bar */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${borderDivider}`}>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center p-1.5 rounded-xl bg-brand-500/10 dark:bg-brand-400/10">
            <GoogleTranslateLogo size={20} />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold tracking-tight whitespace-nowrap">eBookMine Translate</h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Neural AI
            </span>
          </div>
        </div>

        {onClose && !isEmbed && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Close modal"
          >
            <XIcon size={18} />
          </button>
        )}
      </div>

      {/* Main Workspace */}
      <div className={isEmbed ? "py-2 flex-1 space-y-4" : "p-3.5 flex-1 overflow-y-auto space-y-3"}>
        {/* Top Card: Original Text */}
        <div className={`rounded-2xl ${isEmbed ? "border border-slate-200/90 dark:border-slate-800/90 shadow-sm bg-white dark:bg-slate-900" : `border ${bgPanel}`} p-4 flex flex-col justify-between min-h-[150px] transition-all`}>

          <div>
            {/* Header: Quick Tabs on Left, Language Dropdown Aligned to Right */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/50 dark:border-slate-800/50">
              <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex-shrink-0 mr-1">
                  Original Text
                </span>

                <button
                  onClick={() => setSourceLang("auto")}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex-shrink-0 transition ${
                    sourceLang === "auto"
                      ? "bg-brand-600 text-white font-bold"
                      : "hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Auto {detectedLangName && sourceLang === "auto" ? `(${detectedLangName})` : ""}
                </button>

                {POPULAR_LANGUAGES.slice(0, 2).map((lang) => (
                  <button
                    key={`src-${lang.code}`}
                    onClick={() => setSourceLang(lang.code)}
                    className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold flex-shrink-0 transition ${
                      sourceLang === lang.code
                        ? "bg-brand-600 text-white font-bold"
                        : "hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>

              {/* Right Aligned Select Dropdown + Clear Button */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-brand-600 dark:text-brand-400 outline-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition max-w-[130px] truncate"
                >
                  <option value="auto">🌐 Auto Detect</option>
                  {ALL_LANGUAGES.map((l) => (
                    <option key={`src-opt-${l.code}`} value={l.code}>
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>

                {sourceText && (
                  <button
                    onClick={() => {
                      setSourceText("");
                      setTranslatedText("");
                    }}
                    className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={sourceText}
              onChange={handleTextChange}
              placeholder="Type or paste text..."
              rows={3}
              className="w-full bg-transparent resize-none outline-none font-medium leading-normal placeholder:text-slate-400 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50 mt-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => speakText(sourceText, sourceLang, true)}
                disabled={!sourceText}
                className={`p-1.5 rounded-lg border transition ${
                  isSpeakingSource
                    ? "bg-brand-500 text-white border-brand-500 animate-pulse"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                }`}
                title="Listen"
              >
                <VolumeIcon size={14} />
              </button>

              <button
                onClick={() => copyToClipboard(sourceText, true)}
                disabled={!sourceText}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-40 transition"
              >
                {copiedSource ? (
                  <>
                    <CheckIcon size={13} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <span className="text-[10px] font-mono text-slate-400">
              {sourceText.length} / 5000
            </span>
          </div>
        </div>

        {/* Middle: Centered Switch Icon Button Divider */}
        <div className="flex items-center justify-center py-1 relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className={`w-full border-t ${borderDivider}`} />
          </div>
          <button
            onClick={handleSwapLanguages}
            className="relative z-10 flex items-center justify-center h-9 w-9 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-md hover:scale-110 active:scale-95 text-brand-600 dark:text-brand-400 transition-all duration-300 ring-4 ring-white dark:ring-slate-950"
            title="Swap Languages"
          >
            <div className="flex items-center justify-center" style={{ transform: `rotate(${swapRotate}deg)`, transition: "transform 0.4s ease" }}>
              <SwapIcon size={18} />
            </div>
          </button>
        </div>

        {/* Bottom Card: Translation */}
        <div className={`rounded-2xl ${isEmbed ? "border border-brand-500/20 dark:border-brand-900/30 shadow-sm bg-brand-50/30 dark:bg-slate-900" : `border ${bgTargetPanel}`} p-4 flex flex-col justify-between min-h-[150px] transition-all`}>

          <div>
            {/* Header: Quick Tabs on Left, Target Select Aligned Right */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/50 dark:border-slate-800/50">
              <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex-shrink-0 mr-1">
                  Translation
                </span>

                {POPULAR_LANGUAGES.slice(0, 2).map((lang) => (
                  <button
                    key={`tgt-${lang.code}`}
                    onClick={() => setTargetLang(lang.code)}
                    className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold flex-shrink-0 transition ${
                      targetLang === lang.code
                        ? "bg-brand-600 text-white font-bold"
                        : "hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}

                {loading && (
                  <span className="text-[9px] font-semibold text-brand-500 animate-pulse flex-shrink-0">
                    Translating...
                  </span>
                )}
              </div>

              {/* Right Aligned Target Select Dropdown + Font Adjusters */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-brand-600 dark:text-brand-400 outline-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition max-w-[130px] truncate"
                >
                  {ALL_LANGUAGES.map((l) => (
                    <option key={`tgt-opt-${l.code}`} value={l.code}>
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>

              </div>
            </div>

            {loading ? (
              <div className="py-6 flex items-center justify-center space-x-2">
                <div className="h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                <span className="text-xs text-slate-400">Translating...</span>
              </div>
            ) : error ? (
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-xs text-red-600 dark:text-red-300">
                {error}
              </div>
            ) : (
              <p className="font-semibold leading-relaxed text-slate-900 dark:text-slate-100 max-h-36 overflow-y-auto text-xs sm:text-sm">
                {translatedText || <span className="italic text-slate-400 font-normal">Translation output will appear here</span>}
              </p>
            )}

          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50 mt-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => speakText(translatedText, targetLang, false)}
                disabled={!translatedText}
                className={`p-1.5 rounded-lg border transition ${
                  isSpeakingTarget
                    ? "bg-brand-500 text-white border-brand-500 animate-pulse"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                }`}
                title="Listen"
              >
                <VolumeIcon size={14} />
              </button>

              <button
                onClick={() => copyToClipboard(translatedText, false)}
                disabled={!translatedText}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-40 transition"
              >
                {copiedTranslation ? (
                  <>
                    <CheckIcon size={13} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handleExplainAi}
              disabled={!sourceText || loadingAi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white hover:from-brand-700 hover:to-indigo-700 text-[11px] font-bold shadow-md shadow-brand-500/20 transition active:scale-95 disabled:opacity-50"
              title="Generate deep AI explanation of translated text"
            >
              <SparklesIcon size={14} className="text-amber-300" />
              <span>{loadingAi ? "Analyzing..." : "Explain with AI"}</span>
            </button>
          </div>
        </div>

        {/* AI Explanation Section (Separated 2-Language Card Design) */}
        {(loadingAi || aiExplanation) && (
          <div className="space-y-2 animate-fade-in pt-1">
            <div className="flex items-center justify-between pb-1">
              <h4 className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                <SparklesIcon size={15} className="text-amber-500" />
                <span>AI Bilingual Breakdown & Meaning</span>
              </h4>
              {aiExplanation && (
                <button
                  onClick={() => setAiExplanation(null)}
                  className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Dismiss
                </button>
              )}
            </div>

            {loadingAi ? (
              <div className={`rounded-2xl border ${bgPanel} p-4 flex items-center justify-center space-x-2.5`}>
                <div className="h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                <span className="text-xs font-semibold text-slate-500 animate-pulse">
                  AI Tutor generating bilingual explanation in English and {targetLangObj?.name || "target language"}...
                </span>
              </div>
            ) : targetExp ? (
              /* Two Separate Cards Side-by-Side Design */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Left Card: English Explanation */}
                <div className={`rounded-2xl border ${bgPanel} p-3.5 border-brand-500/30 flex flex-col justify-between`}>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-sm">🇺🇸</span>
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                        English Explanation
                      </h5>
                    </div>
                    <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 max-h-56 overflow-y-auto pr-1 space-y-2">
                      {renderAiExplanation(englishExp)}
                    </div>
                  </div>
                </div>

                {/* Right Card: Target Language Explanation */}
                <div className={`rounded-2xl border ${bgTargetPanel} p-3.5 border-brand-500/40 flex flex-col justify-between`}>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-sm">{targetLangObj?.flag || "🌐"}</span>
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                        {targetLangObj?.name || "Target Language"} Explanation
                      </h5>
                    </div>
                    <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 max-h-56 overflow-y-auto pr-1 space-y-2">
                      {renderAiExplanation(targetExp)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Single Language Fallback Card */
              <div className={`rounded-2xl border ${bgPanel} p-3.5 border-brand-500/30`}>
                <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 max-h-56 overflow-y-auto pr-1 space-y-2">
                  {renderAiExplanation(englishExp)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dictionary Section */}
        {definitions.length > 0 && (
          <div className={`rounded-xl border ${bgPanel} p-2.5`}>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              <span>📖</span> Dictionary
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {definitions.map((def, idx) => (
                <div
                  key={`def-${idx}`}
                  className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 text-[11px]"
                >
                  <span className="font-bold text-brand-600 dark:text-brand-400 capitalize">
                    {def.partOfSpeech}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {def.terms.map((term: string, tIdx: number) => (
                      <span
                        key={`term-${tIdx}`}
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[10px]"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Bottom Footer */}
      <div className={`px-3.5 py-2 border-t ${borderDivider} flex items-center justify-between bg-slate-500/5`}>
        <span className="text-[10px] text-slate-400">Powered by eBookMine Translate Neural Engine</span>

        {onClose && !isEmbed && (
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition active:scale-95"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );

  if (isEmbed) {
    return mainContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      {mainContent}
    </div>
  );
}
