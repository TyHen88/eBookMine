export type QueryCategory =
  | "DOCUMENT_OVERVIEW"
  | "CHAPTER_OVERVIEW"
  | "SECTION_QUESTION"
  | "SPECIFIC_FACT"
  | "CONCEPT_EXPLANATION"
  | "PAGE_QUESTION"
  | "COMPARE_SECTIONS"
  | "COMPARE_CHAPTERS"
  | "FIND_TOPIC"
  | "SUMMARY"
  | "STUDY_QUESTION";

export interface QueryRouteStrategy {
  category: QueryCategory;
  targetChapter?: string | null;
  targetPage?: number | null;
  targetSection?: string | null;
  candidateLimits: {
    vectorCandidates: number;
    ftsCandidates: number;
    finalContextChunks: number;
  };
  useHierarchicalSummaries: boolean;
  diversityWeight: number;
}

/**
 * Classifies a user query into structural intent categories and resolves retrieval strategy parameters.
 */
export function classifyAndRouteQuery(question: string): QueryRouteStrategy {
  const cleanQ = question.trim();
  const lowerQ = cleanQ.toLowerCase();

  // 1. Page-Specific Question Detection (e.g., "what is on page 42", "page 15")
  const pageMatch = lowerQ.match(/\bpage\s*(\d+)\b/);
  if (pageMatch) {
    return {
      category: "PAGE_QUESTION",
      targetPage: parseInt(pageMatch[1], 10),
      candidateLimits: {
        vectorCandidates: parseInt(process.env.PAGE_VECTOR_CANDIDATES || "15", 10),
        ftsCandidates: parseInt(process.env.PAGE_FTS_CANDIDATES || "15", 10),
        finalContextChunks: parseInt(process.env.PAGE_FINAL_CHUNKS || "6", 10),
      },
      useHierarchicalSummaries: false,
      diversityWeight: 0.3,
    };
  }

  // 2. Chapter-Specific Question Detection (e.g., "what does Chapter 5 explain about X", "Chapter 2 summary")
  const chapterMatch = lowerQ.match(/\bchapter\s*([0-9ivxlcdm]+|\w+)\b/i);
  if (chapterMatch) {
    const chapterName = `Chapter ${chapterMatch[1]}`;
    const isOverview = lowerQ.includes("summar") || lowerQ.includes("overview") || lowerQ.includes("explain chapter");

    return {
      category: isOverview ? "CHAPTER_OVERVIEW" : "CHAPTER_OVERVIEW",
      targetChapter: chapterName,
      candidateLimits: {
        vectorCandidates: parseInt(process.env.CHAPTER_VECTOR_CANDIDATES || "25", 10),
        ftsCandidates: parseInt(process.env.CHAPTER_FTS_CANDIDATES || "20", 10),
        finalContextChunks: parseInt(process.env.CHAPTER_FINAL_CHUNKS || "10", 10),
      },
      useHierarchicalSummaries: true,
      diversityWeight: 0.6,
    };
  }

  // 3. Document Overview / Book Level Summary (e.g., "summarize key insights of this book")
  if (
    /\b(summarize|overview|key insights|main themes|table of contents|overall summary|book summary)\b/i.test(lowerQ) &&
    /\b(book|document|text|guide|prep|cbt|ielts|toefl|cliffs)\b/i.test(lowerQ)
  ) {
    return {
      category: "DOCUMENT_OVERVIEW",
      candidateLimits: {
        vectorCandidates: parseInt(process.env.OVERVIEW_VECTOR_CANDIDATES || "35", 10),
        ftsCandidates: parseInt(process.env.OVERVIEW_FTS_CANDIDATES || "25", 10),
        finalContextChunks: parseInt(process.env.OVERVIEW_FINAL_CHUNKS || "14", 10),
      },
      useHierarchicalSummaries: true,
      diversityWeight: 0.85,
    };
  }

  // 4. Section / Chapter Comparison Detection
  if (/\b(compare|difference between|versus|vs)\b/i.test(lowerQ)) {
    return {
      category: "COMPARE_CHAPTERS",
      candidateLimits: {
        vectorCandidates: 30,
        ftsCandidates: 20,
        finalContextChunks: 10,
      },
      useHierarchicalSummaries: true,
      diversityWeight: 0.8,
    };
  }

  // 5. Concept Explanation Detection (e.g., "explain how X works", "what is the concept of Y")
  if (/\b(explain|how does|why does|what is the concept|definition of|how to understand)\b/i.test(lowerQ)) {
    return {
      category: "CONCEPT_EXPLANATION",
      candidateLimits: {
        vectorCandidates: parseInt(process.env.CONCEPT_VECTOR_CANDIDATES || "20", 10),
        ftsCandidates: parseInt(process.env.CONCEPT_FTS_CANDIDATES || "15", 10),
        finalContextChunks: parseInt(process.env.CONCEPT_FINAL_CHUNKS || "8", 10),
      },
      useHierarchicalSummaries: true,
      diversityWeight: 0.5,
    };
  }

  // 6. Specific Fact Detection (e.g., "what score is required", "how many questions", "what date")
  if (/\b(what|how many|when|where|which|score|rules|requirements|time|cost)\b/i.test(lowerQ) && !lowerQ.includes("explain")) {
    return {
      category: "SPECIFIC_FACT",
      candidateLimits: {
        vectorCandidates: parseInt(process.env.FACT_VECTOR_CANDIDATES || "15", 10),
        ftsCandidates: parseInt(process.env.FACT_FTS_CANDIDATES || "25", 10),
        finalContextChunks: parseInt(process.env.FACT_FINAL_CHUNKS || "6", 10),
      },
      useHierarchicalSummaries: false,
      diversityWeight: 0.4,
    };
  }

  // Default Fallback: GENERAL FIND_TOPIC Strategy
  return {
    category: "FIND_TOPIC",
    candidateLimits: {
      vectorCandidates: parseInt(process.env.VECTOR_CANDIDATES || "20", 10),
      ftsCandidates: parseInt(process.env.FTS_CANDIDATES || "20", 10),
      finalContextChunks: parseInt(process.env.FINAL_CONTEXT_CHUNKS || "8", 10),
    },
    useHierarchicalSummaries: true,
    diversityWeight: 0.5,
  };
}
