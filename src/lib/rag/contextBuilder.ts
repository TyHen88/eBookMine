import { SummaryRecord } from "./summaryService";
import { HybridRetrievedChunk } from "./hybridRetriever";
import { QueryRouteStrategy } from "./queryRouter";

export interface ContextBuilderOptions {
  bookTitle: string;
  authorName?: string;
  pageContext?: number;
  summaries?: SummaryRecord[];
  chunks: HybridRetrievedChunk[];
  strategy: QueryRouteStrategy;
}

export interface StructuredContextResult {
  promptText: string;
  sourceMap: Map<string, HybridRetrievedChunk>;
}

/**
 * Builds structured, authoritative book context for grounded LLM inference.
 */
export function buildStructuredContext(options: ContextBuilderOptions): StructuredContextResult {
  const { bookTitle, authorName, pageContext, summaries = [], chunks, strategy } = options;

  const sourceMap = new Map<string, HybridRetrievedChunk>();
  chunks.forEach((c) => sourceMap.set(c.id, c));

  let context = `DOCUMENT:\nTitle: "${bookTitle}"\n`;
  if (authorName && authorName !== "Unknown") context += `Author: ${authorName}\n`;
  if (pageContext) context += `Current Reader Location: Page ${pageContext}\n`;
  context += `Query Category: ${strategy.category}\n\n`;

  // Include Persistent Hierarchical Summaries if appropriate
  if (strategy.useHierarchicalSummaries && summaries.length > 0) {
    const bookSummary = summaries.find((s) => s.level === "BOOK");
    if (bookSummary) {
      context += `BOOK OVERVIEW SUMMARY (Pages ${bookSummary.pageStart}-${bookSummary.pageEnd}):\n${bookSummary.summary}\n\n`;
    }

    const chapterSummaries = summaries.filter((s) => s.level === "CHAPTER");
    if (chapterSummaries.length > 0) {
      context += `CHAPTER OVERVIEW SUMMARIES:\n`;
      chapterSummaries.forEach((cs) => {
        context += `- [${cs.chapterTitle} (Pages ${cs.pageStart}-${cs.pageEnd})]: ${cs.summary}\n`;
      });
      context += `\n`;
    }
  }

  // Include Authoritative Book Evidence Sources with explicit SOURCE_ID tags
  context += `AUTHORITATIVE BOOK EVIDENCE SOURCES:\n\n`;

  if (chunks.length === 0) {
    context += `No relevant book content chunks were retrieved.\n`;
  } else {
    chunks.forEach((c, idx) => {
      const pageStr = c.pageStart === c.pageEnd ? `Page ${c.pageStart}` : `Pages ${c.pageStart}–${c.pageEnd}`;
      context += `SOURCE_ID: ${c.id}\n`;
      context += `PAGE_RANGE: ${pageStr}\n`;
      context += `CHAPTER: ${c.chapter || "N/A"}\n`;
      context += `CONTENT:\n"${c.content}"\n\n`;
    });
  }

  return {
    promptText: context,
    sourceMap,
  };
}
