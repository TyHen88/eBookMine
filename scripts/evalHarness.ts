process.env.EVAL_MODE = "true";

import { prisma } from "../src/lib/db";
import { chatWithBook, RagResponse } from "../src/lib/rag/ragService";

export interface EvalCase {
  id: string;
  bookId: string;
  question: string;
  expectedPages: number[]; // Array of ground-truth target pages that should be cited
  expectedKeywords?: string[]; // Key phrases expected in the answer
}

/**
 * Real evaluation test cases.
 * Leave empty for baseline harness; fill in 10-15 real question/page pairs.
 */
export const EVAL_CASES: EvalCase[] = [
  // Example format:
  // {
  //   id: "case-1",
  //   bookId: "your-book-id-here",
  //   question: "What is the primary topic discussed in chapter 1?",
  //   expectedPages: [1, 2, 3],
  //   expectedKeywords: ["introduction", "overview"],
  // },
];

export interface EvalResult {
  caseId: string;
  question: string;
  bookTitle: string;
  expectedPages: number[];
  actualCitedPages: number[];
  citationHit: boolean;
  citationAccuracy: number;
  latencyMs: number;
  answerSnippet: string;
  category: string;
  isFallback: boolean;
}

/**
 * Execute a RAG query through the live ragService pipeline.
 */
export async function runRagQuery(
  userId: string,
  bookId: string,
  question: string
): Promise<{ response: RagResponse; latencyMs: number }> {
  const startTime = Date.now();
  const response = await chatWithBook(userId, bookId, question);
  const latencyMs = Date.now() - startTime;
  return { response, latencyMs };
}

/**
 * Get or create an automated eval test user in PostgreSQL.
 */
async function getOrCreateEvalUser(): Promise<string> {
  const email = "eval-harness@ebookmine.internal";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: "RAG Evaluation Harness",
        role: "ADMIN",
      },
    });
  }
  return user.id;
}

/**
 * Main Evaluation Runner.
 */
async function main() {
  console.log("=================================================");
  console.log("🚀 eBookMine RAG Evaluation Harness");
  console.log("=================================================\n");

  const userId = await getOrCreateEvalUser();
  const cliBookArg = process.argv[2];

  // If EVAL_CASES is empty, run a smoke test against a real book from the database
  if (EVAL_CASES.length === 0) {
    console.log("ℹ️  EVAL_CASES is currently empty.");

    let targetBookId = cliBookArg;
    if (!targetBookId) {
      const firstBook = await prisma.book.findFirst({
        select: { id: true, title: true, _count: { select: { contentChunks: true } } },
      });
      if (firstBook) {
        targetBookId = firstBook.id;
        console.log(`📖 Using first available book from database: "${firstBook.title}" (ID: ${firstBook.id}, Chunks: ${firstBook._count.contentChunks})`);
      }
    }

    if (!targetBookId) {
      console.log("⚠️  No books found in database to evaluate. Ingest a book or supply a bookId argument: `npx tsx scripts/evalHarness.ts <bookId>`");
      process.exit(0);
    }

    const testQuestion = "What are the core ideas and main concepts covered in this book?";
    console.log(`\n🧪 Executing baseline evaluation query:\nQuestion: "${testQuestion}"\n`);

    try {
      const { response, latencyMs } = await runRagQuery(userId, targetBookId, testQuestion);

      const citedPages = Array.from(
        new Set([
          ...response.citations.map((c) => c.pageStart),
          ...response.sources.map((s) => s.page),
        ])
      ).filter(Boolean);

      console.log("-------------------------------------------------");
      console.log("✅ RAG Evaluation Smoke Test Passed");
      console.log(`⏱️  Latency: ${latencyMs}ms`);
      console.log(`🎯 Query Category: ${response.queryCategory}`);
      console.log(`📑 Cited Pages: [${citedPages.join(", ")}] (${response.citations.length} structured citations)`);
      console.log(`💡 Answer Preview:\n${response.answer.slice(0, 300)}...`);
      console.log("-------------------------------------------------");
      console.log("\n✨ Harness is ready. You can now populate EVAL_CASES with real benchmark questions.");
    } catch (err: any) {
      console.error("❌ Evaluation query failed:", err.message || err);
    }
    return;
  }

  // Run full benchmark against populated EVAL_CASES
  const results: EvalResult[] = [];
  let totalHits = 0;
  let totalLatency = 0;

  for (let i = 0; i < EVAL_CASES.length; i++) {
    const testCase = EVAL_CASES[i];
    console.log(`[${i + 1}/${EVAL_CASES.length}] Evaluating "${testCase.question}"...`);

    const book = await prisma.book.findFirst({
      where: { OR: [{ id: testCase.bookId }, { driveFileId: testCase.bookId }] },
      select: { id: true, title: true },
    });

    if (!book) {
      console.warn(`⚠️ Book ID ${testCase.bookId} not found. Skipping.`);
      continue;
    }

    try {
      const { response, latencyMs } = await runRagQuery(userId, book.id, testCase.question);

      const citedPages = Array.from(
        new Set([
          ...response.citations.map((c) => c.pageStart),
          ...response.sources.map((s) => s.page),
        ])
      );

      // Check if any expected page is within the cited pages
      const matchingPages = testCase.expectedPages.filter((p) => citedPages.includes(p));
      const hit = matchingPages.length > 0;
      if (hit) totalHits++;
      totalLatency += latencyMs;

      const accuracy =
        testCase.expectedPages.length > 0
          ? matchingPages.length / testCase.expectedPages.length
          : 1.0;

      results.push({
        caseId: testCase.id,
        question: testCase.question,
        bookTitle: book.title,
        expectedPages: testCase.expectedPages,
        actualCitedPages: citedPages,
        citationHit: hit,
        citationAccuracy: parseFloat((accuracy * 100).toFixed(1)),
        latencyMs,
        answerSnippet: response.answer.slice(0, 100),
        category: response.queryCategory,
        isFallback: !!response.isFallback,
      });
    } catch (err: any) {
      console.error(`❌ Case ${testCase.id} failed:`, err.message);
    }
  }

  // Print Summary Table
  console.log("\n=================================================");
  console.log("📊 Evaluation Summary Report");
  console.log("=================================================");
  console.log(`Total Cases Evaluated: ${results.length}`);
  console.log(`Citation Hit Rate:     ${((totalHits / Math.max(1, results.length)) * 100).toFixed(1)}%`);
  console.log(`Average Latency:       ${Math.round(totalLatency / Math.max(1, results.length))}ms`);
  console.log("=================================================\n");

  console.table(
    results.map((r) => ({
      ID: r.caseId,
      Question: r.question.slice(0, 35) + "...",
      Expected: r.expectedPages.join(","),
      Actual: r.actualCitedPages.join(","),
      Hit: r.citationHit ? "✅" : "❌",
      "Accuracy %": r.citationAccuracy,
      "Latency (ms)": r.latencyMs,
    }))
  );
}

if (require.main === module || process.argv[1]?.includes("evalHarness")) {
  main()
    .catch((err) => {
      console.error("Evaluation error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
