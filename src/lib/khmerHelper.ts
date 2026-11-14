/**
 * Khmer Language & Script Utilities
 * Provides detection, strict linguistic validation, and sanitization to ensure
 * AI outputs maintain authentic Khmer script (ភាសាខ្មែរ) with zero Thai script mixing.
 */

// Khmer Unicode Block: U+1780 - U+17FF (Consonants, Vowels, Subscripts, Diacritics) & Symbols (U+19E0 - U+19FF)
export const KHMER_REGEX = /[\u1780-\u17FF\u19E0-\u19FF]/;

// Thai Unicode Block: U+0E00 - U+0E7F
export const THAI_REGEX = /[\u0E00-\u0E7F]/;

/**
 * Check if a text contains any Khmer script characters.
 */
export function containsKhmer(text?: string | null): boolean {
  if (!text) return false;
  return KHMER_REGEX.test(text);
}

/**
 * Check if a text contains any Thai script characters.
 */
export function containsThai(text?: string | null): boolean {
  if (!text) return false;
  return THAI_REGEX.test(text);
}

/**
 * Sanitizes output to ensure 100% pure Khmer script with ZERO Thai script mixing.
 * Unconditionally strips all Thai Unicode characters (U+0E00 - U+0E7F).
 */
export function sanitizeKhmerOutput(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Unconditionally strip ALL Thai Unicode characters (U+0E00 to U+0E7F)
  cleaned = cleaned.replace(/[\u0E00-\u0E7F]+/g, "");

  // Clean up any redundant double spaces created by removal
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");

  return cleaned;
}

/**
 * Detect whether a user query is requesting a Khmer response.
 * Returns true ONLY if:
 * 1. The query itself contains Khmer script characters (U+1780-U+17FF), OR
 * 2. The query explicitly asks for Khmer (e.g., "in khmer", "to khmer", "khmer meaning", "translate to km").
 * If the user explicitly asks for English ("in english", "to english"), returns false.
 */
export function isKhmerQuestion(question?: string | null): boolean {
  if (!question) return false;
  const trimmed = question.trim();
  if (!trimmed) return false;

  // Explicit request for English overrides Khmer
  if (/\b(?:in|to|into|respond\s+in|answer\s+in|explain\s+in)\s+english\b/i.test(trimmed)) {
    return false;
  }

  // Explicit request for Khmer in Latin characters
  if (/\b(?:in|to|into)\s+(?:khmer|cambodian)\b|\bkhmer\s+(?:meaning|translation|explanation)\b|\b(?:meaning|translate|explain)\b[\s\S]*\bkhmer\b/i.test(trimmed)) {
    return true;
  }

  // Contains Khmer script characters in the user's message
  return containsKhmer(trimmed);
}

/**
 * Detect the primary language of a user question ('km' | 'en').
 */
export function detectQueryLanguage(question?: string | null): "km" | "en" {
  return isKhmerQuestion(question) ? "km" : "en";
}

/**
 * Linguistic system prompt directives for standard Khmer language.
 */
export const KHMER_SYSTEM_DIRECTIVES = `
========================================
🌐 STRICT LANGUAGE DETECTION & MATCHING MANDATE
========================================
1. MATCH USER QUERY LANGUAGE: Always detect the language of the user's question and reply in THAT SAME LANGUAGE by default:
   - If the user asks in English (e.g., "What is...", "Summarize...", "Explain..."), you MUST respond in clear, natural English — even if the attached book title contains Khmer characters — unless the user explicitly asks to translate or explain in Khmer.
   - If the user asks in Khmer (ភាសាខ្មែរ) or explicitly asks for Khmer ("in Khmer", "translate to Khmer"), you MUST respond in pure, natural standard Khmer (អក្សរខ្មែរ / Unicode U+1780-U+17FF).
2. ABSOLUTE ZERO TOLERANCE FOR THAI SCRIPT: When writing Khmer, STRICTLY NEVER output ANY Thai characters (Unicode U+0E00-U+0E7F).
3. KHMER VOCABULARY & GRAMMAR: When replying in Khmer, use authentic Khmer terminology (e.g., "និយមន័យ" for Definition, "ឧទាហរណ៍" for Example, "សេចក្ដីសង្ខេប" for Summary, "ចំណុចសំខាន់ៗ" for Key Takeaways, "បរិបទ" for Context).
========================================`;

