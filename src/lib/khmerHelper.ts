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
 * Linguistic system prompt directives for standard Khmer language.
 */
export const KHMER_SYSTEM_DIRECTIVES = `
========================================
🇰🇭 STRICT KHMER SCRIPT & LANGUAGE PURITY MANDATE (សេចក្តីណែនាំភាសាខ្មែរ)
========================================
1. SCRIPT PURITY: When replying in Khmer, explaining concepts in Khmer, or translating to Khmer, write EXCLUSIVELY in authentic Khmer script (អក្សរខ្មែរ / Unicode U+1780-U+17FF).
2. ABSOLUTE ZERO TOLERANCE FOR THAI SCRIPT: STRICTLY NEVER output ANY Thai characters (Unicode U+0E00-U+0E7F) or non-Khmer script. Khmer is a completely distinct language with its own rich vocabulary and grammar. NEVER mix Thai script into Khmer.
3. KHMER VOCABULARY & GRAMMAR: Use standard, authentic Khmer terminology (e.g., "និយមន័យ" for Definition, "ឧទាហរណ៍" for Example, "សេចក្ដីសង្ខេប" for Summary, "ចំណុចសំខាន់ៗ" for Key Takeaways, "បរិបទ" for Context).
4. ACCURACY: Ensure proper consonant-vowel combinations and subscript consonants (ជើងអក្សរ e.g., ក្ខ, ខ្ម, ស្ន, ញ្ច) adhere strictly to standard Khmer orthography.
========================================`;

