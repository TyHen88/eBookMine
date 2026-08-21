import { HybridRetrievedChunk } from "./hybridRetriever";
import { aiProvider } from "@/lib/ai/aiService";
import { logger } from "@/lib/logger";

export interface RerankerOptions {
  topK?: number;           // Target number of top chunks to return after reranking (default: 6)
  minRelevanceScore?: number; // Minimum relevance score (0-10) to include (default: 2.0)
}

export interface RerankedChunk extends HybridRetrievedChunk {
  rerankScore?: number;
}

/**
 * Cross-Encoder / LLM-assisted semantic reranker.
 * Scores retrieved candidate chunks against the user question to promote high-precision evidence.
 *
 * Uses the fastest available model (Google Gemini Flash / Claude Haiku / Local) for sub-second latency.
 */
export async function rerankChunks(
  query: string,
  chunks: HybridRetrievedChunk[],
  options: RerankerOptions = {}
): Promise<RerankedChunk[]> {
  const topK = options.topK ?? 6;
  const minScore = options.minRelevanceScore ?? 2.0;

  if (chunks.length <= topK) {
    return chunks;
  }

  // Cap candidates for reranking to avoid large prompt payloads (top 15 max)
  const candidatePool = chunks.slice(0, 15);

  const chunkSnippets = candidatePool
    .map((c, idx) => `[Chunk ${idx}] (Page ${c.pageStart}):\n"${c.content.slice(0, 300)}"`)
    .join("\n\n");

  const scoringPrompt = `You are a search reranking judge. Rate how directly relevant each book text chunk is to answering the user question.
Score each chunk on a scale of 0 to 10 (where 10 is an exact, direct answer, 5 is contextually related, and 0 is irrelevant).

USER QUESTION: "${query}"

CANDIDATE CHUNKS:
${chunkSnippets}

Respond ONLY with a valid JSON array of numbers representing the score (0-10) for each chunk in order:
[8.5, 3.0, 9.0, ...]`;

  try {
    const rawReply = await aiProvider.generateText(scoringPrompt);
    const jsonMatch = rawReply.match(/\[[\s\S]*?\]/);

    if (jsonMatch) {
      const scores: number[] = JSON.parse(jsonMatch[0]);

      if (Array.isArray(scores) && scores.length > 0) {
        const scoredChunks: RerankedChunk[] = candidatePool.map((chunk, idx) => ({
          ...chunk,
          rerankScore: typeof scores[idx] === "number" ? scores[idx] : chunk.rrfScore * 10,
        }));

        // Filter and sort by reranker score descending
        const sorted = scoredChunks
          .filter((c) => (c.rerankScore ?? 0) >= minScore)
          .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));

        if (sorted.length > 0) {
          return sorted.slice(0, topK);
        }
      }
    }
  } catch (err: any) {
    logger.warn(`[Reranker] LLM scoring fallback triggered: ${err?.message || err}`);
  }

  // Graceful fallback to original RRF score order
  return candidatePool.slice(0, topK);
}
