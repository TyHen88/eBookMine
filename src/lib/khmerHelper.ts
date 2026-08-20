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
  // Thai particles and filler words
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
  [/\bการ\b/g, "ការ"],
  [/\bความ\b/g, "ភាព"],
  [/\bไม่\b/g, "មិន"],
  [/\bได้\b/g, "បាន"],
  [/\bจะ\b/g, "នឹង"],
  [/\bให้\b/g, "ឱ្យ"],
  [/\bไป\b/g, "ទៅ"],
  [/\bมา\b/g, "មក"],
  [/\bกับ\b/g, "ជាមួយ"],
  [/\bโดย\b/g, "ដោយ"],
  [/\bจาก\b/g, "ពី"],
  [/\bผู้\b/g, "អ្នក"],
];

/**
 * Sanitizes output to ensure 100% pure Khmer script with ZERO Thai script mixing.
 * Unconditionally strips all Thai Unicode characters (U+0E00 - U+0E7F).
 */
export function sanitizeKhmerOutput(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Replace known Thai words with authentic Khmer equivalents
  for (const [regex, replacement] of THAI_TO_KHMER_REPLACEMENTS) {
    cleaned = cleaned.replace(regex, replacement);
  }

  // 2. Unconditionally strip ALL remaining Thai Unicode characters (U+0E00 to U+0E7F)
  cleaned = cleaned.replace(/[\u0E00-\u0E7F]+/g, "");

  // 3. Clean up any redundant double spaces created by removal
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
2. ABSOLUTE ZERO TOLERANCE FOR THAI SCRIPT: STRICTLY NEVER output ANY Thai characters (ภาษาไทย / Thai Unicode U+0E00-U+0E7F), Lao characters, or Thai vocabulary/particles (e.g., ครับ, ค่ะ, และ, ของ, ใน, เป็นต้น). Khmer is a completely distinct language with its own rich vocabulary and grammar. NEVER mix Thai script into Khmer.
3. KHMER VOCABULARY & GRAMMAR: Use standard, authentic Khmer terminology (e.g., "និយមន័យ" for Definition, "ឧទាហរណ៍" for Example, "សេចក្ដីសង្ខេប" for Summary, "ចំណុចសំខាន់ៗ" for Key Takeaways, "បរិបទ" for Context).
4. ACCURACY: Ensure proper consonant-vowel combinations and subscript consonants (ជើងអក្សរ e.g., ក្ខ, ខ្ម, ស្ន, ញ្ច) adhere strictly to standard Khmer orthography.
========================================`;
