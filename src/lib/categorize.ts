// Guess a book category from its title/filename using keyword rules.
// First matching category (in priority order) wins; falls back to "Other".

export const CATEGORIES = [
  "Grammar",
  "Conversation",
  "Vocabulary",
  "IELTS",
  "TOEFL",
  "TOEIC",
  "Reading",
  "Writing",
  "Listening",
  "Speaking",
  "Pronunciation",
  "Business",
  "Kids",
  "Dictionary",
  "Exam Prep",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Ordered: earlier rules take precedence (e.g. "IELTS Writing" -> IELTS).
const RULES: [Category, RegExp][] = [
  ["IELTS", /\bielts\b/i],
  ["TOEFL", /\btoefl\b/i],
  ["TOEIC", /\btoeic\b/i],
  ["Grammar", /\bgrammar\b/i],
  ["Conversation", /\b(conversation|dialogue|dialog)\b/i],
  ["Vocabulary", /\b(vocabulary|vocab|idioms?|phrasal|collocations?)\b/i],
  ["Pronunciation", /\b(pronunciation|phonetics?|phonics)\b/i],
  ["Writing", /\b(writing|essays?|composition)\b/i],
  ["Reading", /\b(reading|comprehension)\b/i],
  ["Listening", /\blistening\b/i],
  ["Speaking", /\bspeaking\b/i],
  ["Business", /\bbusiness\b/i],
  ["Kids", /\b(kids?|children|child|young learners?|primary)\b/i],
  ["Dictionary", /\b(dictionary|thesaurus)\b/i],
  ["Exam Prep", /\b(exam|test|practice|cracking|strategies)\b/i],
];

export function categorize(text: string): Category {
  for (const [category, re] of RULES) {
    if (re.test(text)) return category;
  }
  return "Other";
}
