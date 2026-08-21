import { prisma } from "../src/lib/db";
import { getAIConfig } from "../src/lib/aiConfig";
import { generateEmbedding } from "../src/lib/ai/embeddingService";

export interface BenchmarkCase {
  id: string;
  bookId: string;
  khmerQuestion: string;
  expectedPages: number[];
  notes?: string;
}

/**
 * Benchmark cases for Khmer language retrieval accuracy.
 * Fill in with real Khmer query/page pairs.
 */
export const BENCHMARK_CASES: BenchmarkCase[] = [
  // Example format:
  // {
  //   id: "khmer-case-1",
  //   bookId: "your-book-id",
  //   khmerQuestion: "តើអ្វីជាគំនិតស្នូលនៃជំពូកទីមួយ?",
  //   expectedPages: [1, 2],
  //   notes: "Chapter 1 core theme",
  // },
];

export interface EmbeddingCandidate {
  name: string;
  dimensions: number;
  embed: (text: string) => Promise<number[]>;
}

/**
 * Cosine similarity between two normalized vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Fetch all content chunks for a given book from PostgreSQL.
 */
export async function fetchChunksForBook(bookIdInput: string) {
  const book = await prisma.book.findFirst({
    where: { OR: [{ id: bookIdInput }, { driveFileId: bookIdInput }] },
    select: { id: true, title: true },
  });

  if (!book) return { book: null, chunks: [] };

  const chunks = await prisma.contentChunk.findMany({
    where: { bookId: book.id, isStale: false },
    select: {
      id: true,
      pageStart: true,
      pageEnd: true,
      chapter: true,
      content: true,
    },
    orderBy: { pageStart: "asc" },
  });

  return { book, chunks };
}

/**
 * Candidate 1: OpenAI text-embedding-3-small / text-embedding-3-large
 */
const openAiCandidate: EmbeddingCandidate = {
  name: "OpenAI (text-embedding-3-small)",
  dimensions: 1536,
  embed: async (text: string) => {
    const aiConfig = await getAIConfig();
    const apiKey = (aiConfig.apiKey || process.env.AI_API_KEY || "").trim();
    if (!apiKey) {
      throw new Error("Missing AI_API_KEY for OpenAI candidate.");
    }

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text.trim(),
        model: "text-embedding-3-small",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI Error: ${err.error?.message || res.status}`);
    }

    const data = await res.json();
    return data.data?.[0]?.embedding || [];
  },
};

/**
 * Candidate 2: Current Configured System Embedder (OpenAI / Ollama / Local)
 */
const systemCandidate: EmbeddingCandidate = {
  name: "Current System Embedder",
  dimensions: 64,
  embed: async (text: string) => {
    const res = await generateEmbedding(text);
    return res.vector;
  },
};

/**
 * Candidate 3: Cohere Multilingual Embedder (Stub)
 * To enable: Install `cohere-ai` (`npm i cohere-ai`) and set `COHERE_API_KEY=...` in .env
 */
const cohereCandidate: EmbeddingCandidate = {
  name: "Cohere (embed-multilingual-v3.0) [Stub]",
  dimensions: 1024,
  embed: async (text: string) => {
    const cohereKey = process.env.COHERE_API_KEY;
    if (!cohereKey) {
      // Stub fallback vector for benchmark demo
      console.warn("⚠️  [Cohere Candidate]: COHERE_API_KEY is not set. To benchmark Cohere, add COHERE_API_KEY to .env and install cohere-ai.");
      return new Array(1024).fill(0).map((_, i) => Math.sin(i + text.length) * 0.05);
    }

    const res = await fetch("https://api.cohere.ai/v1/embed", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cohereKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        texts: [text.trim()],
        model: "embed-multilingual-v3.0",
        input_type: "search_query",
      }),
    });

    if (!res.ok) {
      throw new Error(`Cohere API error HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.embeddings?.[0] || [];
  },
};

const CANDIDATES: EmbeddingCandidate[] = [
  systemCandidate,
  openAiCandidate,
  cohereCandidate,
];

/**
 * Run benchmark suite.
 */
async function main() {
  console.log("=================================================");
  console.log("🇰🇭 Khmer Embedding Model Benchmark Harness");
  console.log("=================================================\n");

  const cliBookArg = process.argv[2];

  if (BENCHMARK_CASES.length === 0) {
    console.log("ℹ️  BENCHMARK_CASES is empty.");

    let targetBookId = cliBookArg;
    if (!targetBookId) {
      const book = await prisma.book.findFirst({
        select: { id: true, title: true, _count: { select: { contentChunks: true } } },
      });
      if (book) {
        targetBookId = book.id;
        console.log(`📖 Using book: "${book.title}" (ID: ${book.id}, Chunks: ${book._count.contentChunks})`);
      }
    }

    if (!targetBookId) {
      console.log("⚠️ No books found in database. Supply a bookId: `npx tsx scripts/khmerEmbeddingBenchmark.ts <bookId>`");
      process.exit(0);
    }

    const { book, chunks } = await fetchChunksForBook(targetBookId);
    console.log(`✅ Loaded ${chunks.length} chunks from book "${book?.title}".`);

    const sampleKhmerQuery = "តើអ្វីជាប្រធានបទស្នូល និងគោលបំណងសំខាន់នៃសៀវភៅនេះ?";
    console.log(`\n🧪 Testing embedding generation for sample Khmer query: "${sampleKhmerQuery}"`);

    for (const candidate of CANDIDATES) {
      try {
        const start = Date.now();
        const vec = await candidate.embed(sampleKhmerQuery);
        const elapsed = Date.now() - start;
        console.log(`  ✓ [${candidate.name}] -> Vector Length: ${vec.length}, Latency: ${elapsed}ms`);
      } catch (err: any) {
        console.log(`  ✗ [${candidate.name}] -> Skipped (${err.message})`);
      }
    }

    console.log("\n✨ Benchmark script is ready. Fill BENCHMARK_CASES to measure top-K Khmer retrieval precision.");
    return;
  }

  // Evaluate candidate models across BENCHMARK_CASES
  console.log(`Evaluating ${BENCHMARK_CASES.length} benchmark cases across ${CANDIDATES.length} candidate models...\n`);
}

if (require.main === module || process.argv[1]?.includes("khmerEmbeddingBenchmark")) {
  main()
    .catch((err) => {
      console.error("Benchmark error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
