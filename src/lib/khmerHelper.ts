/**
 * Khmer Language & Script Utilities
 * Provides detection, strict linguistic validation, and sanitization to ensure
 * AI outputs maintain authentic Khmer script (ភាសាខ្មែរ) without mixing Thai script or vocabulary.
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
 * Common Thai filler words/particles that multilingual LLMs sometimes mistakenly output.
 * Maps them to proper Khmer equivalents or removes them.
 */
const THAI_TO_KHMER_REPLACEMENTS: Array<[RegExp, string]> = [
  // Thai particles
  [/\bครับ\b/g, ""],
  [/\bค่ะ\b/g, ""],
  [/\bนะ\b/g, ""],
  [/\bและ\b/g, "និង"],
  [/\bหรือ\b/g, "ឬ"],
  [/\bของ\b/g, "របស់"],
  [/\bใน\b/g, "ក្នុង"],
  [/\bที่\b/g, "ដែល"],
  [/\bเป็น\b/g, "ជា"],
  [/\bมี\b/g, "មាន"],
  [/\bได้แก่\b/g, "រួមមាន"],
  [/\bเช่น\b/g, "ឧទាហរណ៍ដូចជា"],
  [/\bดังนี้\b/g, "ដូចតទៅ"],
  [/\bคือ\b/g, "គឺ"],
  [/\bดังนั้น\b/g, "ដូច្នេះ"],
  [/\bเพราะ\b/g, "ពីព្រោះ"],
  [/\bแต่\b/g, "ប៉ុន្តែ"],
  [/\bเพื่อ\b/g, "ដើម្បី"],
];

/**
 * Sanitizes AI output to ensure pure Khmer script with zero Thai script mixing.
 * If text is in Khmer or intended for Khmer context, any stray Thai characters are cleanly eliminated/converted.
 */
export function sanitizeKhmerOutput(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Replace known Thai words with Khmer equivalents
  for (const [regex, replacement] of THAI_TO_KHMER_REPLACEMENTS) {
    cleaned = cleaned.replace(regex, replacement);
  }

  // 2. If the text is primarily Khmer or contains both Khmer and Thai, strip any remaining Thai Unicode characters
  if (containsKhmer(cleaned) && containsThai(cleaned)) {
    // Remove isolated Thai Unicode glyphs
    cleaned = cleaned.replace(/[\u0E00-\u0E7F]+/g, "");
    // Clean up possible double spaces created by removal
    cleaned = cleaned.replace(/ {2,}/g, " ");
  }

  return cleaned;
}

/**
 * Linguistic system prompt directives for standard Khmer language.
 */
export const KHMER_SYSTEM_DIRECTIVES = `
========================================
🇰🇭 KHMER LANGUAGE & SCRIPT PURITY DIRECTIVE (សេចក្តីណែនាំភាសាខ្មែរ)
========================================
1. SCRIPT PURITY: When replying in Khmer, explaining concepts in Khmer, or translating to Khmer, write EXCLUSIVELY in authentic Khmer script (អក្សរខ្មែរ / Unicode U+1780-U+17FF).
2. ZERO TOLERANCE FOR THAI SCRIPT: NEVER mix Thai characters (ภาษาไทย / Thai Unicode U+0E00-U+0E7F), Lao characters, or Thai vocabulary/particles (e.g., ครับ, ค่ะ, และ, ของ, ใน, เป็นต้น) into Khmer responses. Khmer is a distinct language with its own rich vocabulary and grammar.
3. KHMER VOCABULARY & GRAMMAR: Use standard, natural Khmer terminology (e.g., "និយមន័យ" for Definition, "ឧទាហរណ៍" for Example, "សេចក្ដីសង្ខេប" for Summary, "ចំណុចសំខាន់ៗ" for Key Takeaways, "បរិបទ" for Context).
4. ACCURACY: Ensure proper consonant-vowel combinations and subscript consonants (ជើងអក្សរ e.g., ក្ខ, ខ្ម, ស្ន, ញ្ច) adhere strictly to standard Khmer orthography.
========================================`;
