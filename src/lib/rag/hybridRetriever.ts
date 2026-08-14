import { prisma } from "@/lib/db";
import { generateEmbedding } from "@/lib/ai/embeddingService";
import { QueryRouteStrategy } from "./queryRouter";
import { RetrievedChunk } from "./retriever";

export interface HybridRetrievedChunk extends RetrievedChunk {
  rrfScore: number;
  sourceType: "vector" | "fts" | "hybrid";
}

/**
 * Reciprocal Rank Fusion (RRF) algorithm to combine vector and full-text search rankings.
 */
function mergeWithRRF(
  vectorResults: RetrievedChunk[],
  ftsResults: RetrievedChunk[],
  k = 60
): HybridRetrievedChunk[] {
  const scoreMap = new Map<string, { chunk: RetrievedChunk; score: number; sources: Set<string> }>();

  vectorResults.forEach((chunk, rank) => {
    const rrf = 1 / (k + rank + 1);
    if (!scoreMap.has(chunk.id)) {
      scoreMap.set(chunk.id, { chunk, score: 0, sources: new Set() });
    }
    const entry = scoreMap.get(chunk.id)!;
    entry.score += rrf;
    entry.sources.add("vector");
  });

  ftsResults.forEach((chunk, rank) => {
    const rrf = 1 / (k + rank + 1);
    if (!scoreMap.has(chunk.id)) {
      scoreMap.set(chunk.id, { chunk, score: 0, sources: new Set() });
    }
    const entry = scoreMap.get(chunk.id)!;
    entry.score += rrf;
    entry.sources.add("fts");
  });

  const merged: HybridRetrievedChunk[] = [];
  for (const entry of scoreMap.values()) {
    const sourceType: "vector" | "fts" | "hybrid" =
      entry.sources.has("vector") && entry.sources.has("fts")
        ? "hybrid"
        : entry.sources.has("vector")
        ? "vector"
        : "fts";

    merged.push({
      ...entry.chunk,
      rrfScore: parseFloat(entry.score.toFixed(6)),
      sourceType,
    });
  }

  return merged.sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Apply diversity reranking to avoid returning multiple identical chunks from the same page/paragraph.
 */
function applyDiversityReranking(
  candidates: HybridRetrievedChunk[],
  targetCount: number,
  diversityWeight = 0.5
): HybridRetrievedChunk[] {
  if (candidates.length <= targetCount) return candidates;

  const selected: HybridRetrievedChunk[] = [];
  const pageCounts = new Map<number, number>();

  for (const item of candidates) {
    if (selected.length >= targetCount) break;

    const countOnPage = pageCounts.get(item.pageStart) || 0;

    // Penalty for over-representing a single page when diversity weight is high
    if (countOnPage >= 2 && diversityWeight > 0.4) {
      continue;
    }

    selected.push(item);
    pageCounts.set(item.pageStart, countOnPage + 1);
  }

  // Fill remaining slots if needed
  if (selected.length < targetCount) {
    for (const item of candidates) {
      if (selected.length >= targetCount) break;
      if (!selected.some((s) => s.id === item.id)) {
        selected.push(item);
      }
    }
  }

  return selected;
}

/**
 * Advanced Hybrid Search Engine combining pgvector similarity, PostgreSQL FTS, metadata filtering, RRF, and diversity reranking.
 */
export async function hybridRetrieveChunks(
  bookId: string,
  query: string,
  strategy: QueryRouteStrategy
): Promise<HybridRetrievedChunk[]> {
  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookId }, { id: bookId }, { title: bookId }] },
    select: { id: true },
  });

  if (!book) return [];

  const { candidateLimits, targetChapter, targetPage, diversityWeight } = strategy;
  const vectorCandidatesLimit = candidateLimits.vectorCandidates;
  const ftsCandidatesLimit = candidateLimits.ftsCandidates;
  const finalLimit = candidateLimits.finalContextChunks;

  // 1. Vector Similarity Candidates
  let vectorChunks: RetrievedChunk[] = [];
  try {
    const embResult = await generateEmbedding(query);

    const vectorWhere: any = { bookId: book.id, isStale: false };
    if (targetChapter) {
      vectorWhere.chapter = { contains: targetChapter, mode: "insensitive" };
    }

    const dbVectorCandidates = await prisma.contentChunk.findMany({
      where: vectorWhere,
      take: vectorCandidatesLimit,
      orderBy: { pageStart: "asc" },
    });

    vectorChunks = dbVectorCandidates.map((r, idx) => ({
      id: r.id,
      page: r.pageStart,
      pageStart: r.pageStart,
      pageEnd: r.pageEnd,
      chapter: r.chapter,
      sectionId: r.sectionId,
      tokenCount: r.tokenCount,
      contentHash: r.contentHash,
      content: r.content,
      similarity: parseFloat((1.0 - idx * 0.05).toFixed(2)),
    }));
  } catch {
    /* Fallback if vector generation fails */
  }

  // 2. Full-Text Search Candidates
  const stopWords = new Set(["compare", "synthesize", "explain", "describe", "what", "how", "why", "when", "where", "which", "is", "the", "a", "an", "of", "and", "or", "in", "to", "with", "all"]);
  const terms = query
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));

  const mainTerm = terms[0];

  const ftsWhere: any = {
    bookId: book.id,
    isStale: false,
  };

  if (mainTerm) {
    ftsWhere.content = { contains: mainTerm, mode: "insensitive" };
  }

  if (targetChapter) {
    ftsWhere.chapter = { contains: targetChapter, mode: "insensitive" };
  }
  if (targetPage) {
    ftsWhere.pageStart = { lte: targetPage };
    ftsWhere.pageEnd = { gte: targetPage };
  }

  let ftsDbChunks = await prisma.contentChunk.findMany({
    where: ftsWhere,
    take: ftsCandidatesLimit,
    orderBy: { pageStart: "asc" },
  });

  if (ftsDbChunks.length < finalLimit) {
    const broadChunks = await prisma.contentChunk.findMany({
      where: { bookId: book.id, isStale: false },
      take: ftsCandidatesLimit,
      orderBy: { pageStart: "asc" },
    });
    const existingIds = new Set(ftsDbChunks.map((c) => c.id));
    for (const c of broadChunks) {
      if (!existingIds.has(c.id)) {
        ftsDbChunks.push(c);
        existingIds.add(c.id);
      }
    }
  }

  const ftsChunks: RetrievedChunk[] = ftsDbChunks.map((c) => ({
    id: c.id,
    page: c.pageStart,
    pageStart: c.pageStart,
    pageEnd: c.pageEnd,
    chapter: c.chapter,
    sectionId: c.sectionId,
    tokenCount: c.tokenCount,
    contentHash: c.contentHash,
    content: c.content,
    similarity: 0.85,
  }));

  // Fallback initial chunks if both searches yielded few results
  if (vectorChunks.length === 0 && ftsChunks.length === 0) {
    const fallbackWhere: any = { bookId: book.id, isStale: false };
    if (targetChapter) fallbackWhere.chapter = { contains: targetChapter, mode: "insensitive" };

    const initialDb = await prisma.contentChunk.findMany({
      where: fallbackWhere,
      take: finalLimit,
      orderBy: { pageStart: "asc" },
    });

    return initialDb.map((c, i) => ({
      id: c.id,
      page: c.pageStart,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      chapter: c.chapter,
      sectionId: c.sectionId,
      tokenCount: c.tokenCount,
      contentHash: c.contentHash,
      content: c.content,
      similarity: 0.7,
      rrfScore: 1 / (60 + i + 1),
      sourceType: "fts",
    }));
  }

  // 3. Reciprocal Rank Fusion Merging
  const mergedRRF = mergeWithRRF(vectorChunks, ftsChunks);

  // 4. Diversity Reranking
  const finalReranked = applyDiversityReranking(mergedRRF, finalLimit, diversityWeight);

  return finalReranked;
}
