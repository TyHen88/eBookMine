import { prisma } from "@/lib/db";

export interface CitationItem {
  sourceId: string;
  pageStart: number;
  pageEnd: number;
  chapterTitle?: string | null;
  sectionTitle?: string | null;
  snippet: string;
}

export interface ValidatedCitationResult {
  answer: string;
  citations: CitationItem[];
  isValidated: boolean;
  rawSourceIds: string[];
}

/**
 * Parses, verifies, and resolves LLM source IDs against PostgreSQL database records.
 * Strips invalid or hallucinated source IDs and replaces them with true page range citations.
 */
export async function validateAndResolveCitations(
  bookId: string,
  rawLlmOutput: string
): Promise<ValidatedCitationResult> {
  let answerText = rawLlmOutput.trim();
  let extractedSourceIds: string[] = [];

  // Attempt 1: Parse structured JSON output if output starts with JSON block or braces
  const jsonMatch = rawLlmOutput.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.answer && typeof parsed.answer === "string") {
        answerText = parsed.answer.trim();
      }
      if (Array.isArray(parsed.sources)) {
        extractedSourceIds = parsed.sources.map(String);
      } else if (Array.isArray(parsed.sourceIds)) {
        extractedSourceIds = parsed.sourceIds.map(String);
      }
    } catch {
      /* Fallback to regex extraction */
    }
  }

  // Attempt 2: Extract source IDs via Regex (e.g., "chunk_123" or "SOURCE_ID: chunk_123")
  const idMatches = rawLlmOutput.match(/\b(chunk_[a-zA-Z0-9_-]+)\b/g);
  if (idMatches) {
    extractedSourceIds = Array.from(new Set([...extractedSourceIds, ...idMatches]));
  }

  if (extractedSourceIds.length === 0) {
    return {
      answer: answerText,
      citations: [],
      isValidated: false,
      rawSourceIds: [],
    };
  }

  // Query database to verify source IDs belong to bookId and have valid page metadata
  const validDbChunks = await prisma.contentChunk.findMany({
    where: {
      id: { in: extractedSourceIds },
      bookId,
      isStale: false,
    },
    include: {
      section: true,
    },
  });

  const validChunkMap = new Map<string, typeof validDbChunks[0]>();
  validDbChunks.forEach((c) => validChunkMap.set(c.id, c));

  const validatedCitations: CitationItem[] = [];
  const verifiedPageStrings: string[] = [];

  for (const sourceId of extractedSourceIds) {
    const dbChunk = validChunkMap.get(sourceId);
    if (!dbChunk) continue; // Remove hallucinated or invalid source ID

    const pStart = dbChunk.pageStart || dbChunk.page || 1;
    const pEnd = dbChunk.pageEnd || pStart;
    const pageLabel = pStart === pEnd ? `Page ${pStart}` : `Pages ${pStart}–${pEnd}`;

    if (!verifiedPageStrings.includes(pageLabel)) {
      verifiedPageStrings.push(pageLabel);
    }

    validatedCitations.push({
      sourceId: dbChunk.id,
      pageStart: pStart,
      pageEnd: pEnd,
      chapterTitle: dbChunk.chapter || null,
      sectionTitle: dbChunk.section?.title || null,
      snippet: dbChunk.content.substring(0, 150) + "...",
    });
  }

  // Append validated page citations to answer if not already cited
  if (verifiedPageStrings.length > 0 && !answerText.includes("[Page")) {
    answerText += `\n\n**Sources & Page References**: [${verifiedPageStrings.join(", ")}]`;
  }

  return {
    answer: answerText,
    citations: validatedCitations,
    isValidated: validatedCitations.length > 0,
    rawSourceIds: extractedSourceIds,
  };
}
