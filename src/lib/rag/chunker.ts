import { createHash } from "crypto";

export interface RawPageText {
  page: number;
  text: string;
  chapter?: string;
  layoutMetadata?: string;
}

export interface DocumentPageInput {
  pageNumber: number;
  text: string;
  layoutMetadata?: string;
  tokenCount: number;
}

export interface DocumentStructureItem {
  title: string;
  level: number;
  pageStart: number;
  pageEnd: number;
  orderingIndex: number;
}

export interface ContentChunkItem {
  pageStart: number;
  pageEnd: number;
  chapter?: string;
  sectionTitle?: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  contentHash: string;
  metadata?: string;
}

export interface IngestionStructureResult {
  documentHash: string;
  pages: DocumentPageInput[];
  structures: DocumentStructureItem[];
  chunks: ContentChunkItem[];
  totalTokens: number;
}

/**
 * Approximates token count for a text string (~4 characters per token).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length * 1.3));
}

/**
 * Generates deterministic SHA-256 hash for content.
 */
export function generateContentHash(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex");
}

/**
 * Detect heading level from text line.
 */
function detectHeading(line: string): { isHeading: boolean; title: string; level: number } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return null;

  // Markdown heading check
  if (/^#+\s+/.test(trimmed)) {
    const level = (trimmed.match(/^#+/) || ["#"])[0].length;
    const title = trimmed.replace(/^#+\s+/, "");
    return { isHeading: true, title, level: Math.min(level, 3) };
  }

  // Chapter / Section / Part keyword check
  if (/^(chapter|section|part|unit|lesson|module)\s+[0-9ivxlcdm]+/i.test(trimmed)) {
    return { isHeading: true, title: trimmed, level: 1 };
  }

  // Numbered section e.g. "1.2 Introduction"
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(trimmed) && trimmed.length < 60) {
    const dots = (trimmed.match(/\./g) || []).length;
    return { isHeading: true, title: trimmed, level: Math.min(dots + 1, 3) };
  }

  // ALL CAPS short line check (e.g. "INTRODUCTION")
  if (trimmed.length >= 4 && trimmed.length <= 45 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return { isHeading: true, title: trimmed, level: 2 };
  }

  return null;
}

/**
 * Structure-aware semantic chunking pipeline.
 * Extracts page records, document section hierarchy, and traceable semantic chunks.
 */
export function processDocumentContent(rawPages: RawPageText[]): IngestionStructureResult {
  // Sort pages by page number strictly
  const sortedPages = [...rawPages].sort((a, b) => a.page - b.page);

  // Compute overall document hash for idempotency checking
  const fullTextStream = sortedPages.map((p) => `[PAGE ${p.page}]\n${p.text}`).join("\n\n");
  const documentHash = generateContentHash(fullTextStream);

  const pages: DocumentPageInput[] = [];
  const structures: DocumentStructureItem[] = [];
  const chunks: ContentChunkItem[] = [];

  let currentHeading = "General Content";
  let activeSectionStartPage = sortedPages[0]?.page || 1;
  let sectionIndex = 0;
  let chunkGlobalIndex = 0;
  let grandTotalTokens = 0;

  for (const pageObj of sortedPages) {
    const pNum = pageObj.page;
    const rawText = pageObj.text.trim();
    if (!rawText) continue;

    const pageTokens = estimateTokenCount(rawText);
    grandTotalTokens += pageTokens;

    pages.push({
      pageNumber: pNum,
      text: rawText,
      layoutMetadata: pageObj.layoutMetadata,
      tokenCount: pageTokens,
    });

    // Split page into paragraphs
    const paragraphs = rawText.split(/\n\s*\n/).filter((para) => para.trim().length > 0);

    let currentChunkText = "";
    let chunkStartPage = pNum;

    for (const para of paragraphs) {
      const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);

      // Check if paragraph starts with a heading
      if (lines.length > 0) {
        const hInfo = detectHeading(lines[0]);
        if (hInfo) {
          // If we had an active chunk built, flush it
          if (currentChunkText.trim()) {
            const tokenCount = estimateTokenCount(currentChunkText);
            chunks.push({
              pageStart: chunkStartPage,
              pageEnd: pNum,
              chapter: pageObj.chapter || currentHeading,
              sectionTitle: currentHeading,
              chunkIndex: chunkGlobalIndex++,
              content: currentChunkText.trim(),
              tokenCount,
              contentHash: generateContentHash(currentChunkText),
              metadata: JSON.stringify({
                heading: currentHeading,
                pageStart: chunkStartPage,
                pageEnd: pNum,
              }),
            });
            currentChunkText = "";
          }

          // Register new structure section
          if (structures.length > 0) {
            structures[structures.length - 1].pageEnd = Math.max(1, pNum - 1);
          }

          currentHeading = hInfo.title;
          activeSectionStartPage = pNum;
          structures.push({
            title: hInfo.title,
            level: hInfo.level,
            pageStart: pNum,
            pageEnd: pNum,
            orderingIndex: sectionIndex++,
          });
        }
      }

      const cleanPara = para.replace(/\s+/g, " ").trim();

      // Semantic chunking: target ~400-800 characters (~100-200 words) without splitting paragraphs
      if (currentChunkText.length + cleanPara.length > 600 && currentChunkText.length > 0) {
        const tokenCount = estimateTokenCount(currentChunkText);
        chunks.push({
          pageStart: chunkStartPage,
          pageEnd: pNum,
          chapter: pageObj.chapter || currentHeading,
          sectionTitle: currentHeading,
          chunkIndex: chunkGlobalIndex++,
          content: currentChunkText.trim(),
          tokenCount,
          contentHash: generateContentHash(currentChunkText),
          metadata: JSON.stringify({
            heading: currentHeading,
            pageStart: chunkStartPage,
            pageEnd: pNum,
          }),
        });

        // Small semantic overlap (keep last sentence if available)
        const sentences = currentChunkText.split(/(?<=[.!?])\s+/);
        const lastSentence = sentences.length > 1 ? sentences[sentences.length - 1] : "";
        currentChunkText = lastSentence ? `${lastSentence}\n${cleanPara}` : cleanPara;
        chunkStartPage = pNum;
      } else {
        if (!currentChunkText) chunkStartPage = pNum;
        currentChunkText = currentChunkText ? `${currentChunkText}\n${cleanPara}` : cleanPara;
      }
    }

    // Flush remaining chunk for page
    if (currentChunkText.trim()) {
      const tokenCount = estimateTokenCount(currentChunkText);
      chunks.push({
        pageStart: chunkStartPage,
        pageEnd: pNum,
        chapter: pageObj.chapter || currentHeading,
        sectionTitle: currentHeading,
        chunkIndex: chunkGlobalIndex++,
        content: currentChunkText.trim(),
        tokenCount,
        contentHash: generateContentHash(currentChunkText),
        metadata: JSON.stringify({
          heading: currentHeading,
          pageStart: chunkStartPage,
          pageEnd: pNum,
        }),
      });
    }
  }

  // Close out final structure section pageEnd
  if (structures.length > 0 && sortedPages.length > 0) {
    structures[structures.length - 1].pageEnd = sortedPages[sortedPages.length - 1].page;
  }

  return {
    documentHash,
    pages,
    structures,
    chunks,
    totalTokens: grandTotalTokens,
  };
}

/**
 * Backward-compatible helper for legacy API calls.
 */
export function chunkPageText(pages: RawPageText[]): Array<{ page: number; chapter?: string; content: string; metadata?: string }> {
  const result = processDocumentContent(pages);
  return result.chunks.map((c) => ({
    page: c.pageStart,
    chapter: c.chapter,
    content: c.content,
    metadata: c.metadata,
  }));
}
