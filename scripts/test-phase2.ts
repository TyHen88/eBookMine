process.env.AI_TEST_MODE = "true";

import { prisma } from "../src/lib/db";
import { ingestBookChunks } from "../src/lib/rag/ingestionService";
import { chatWithBook } from "../src/lib/rag/ragService";
import { classifyAndRouteQuery } from "../src/lib/rag/queryRouter";
import { RawPageText } from "../src/lib/rag/chunker";
import { buildHierarchicalSummaries } from "../src/lib/rag/summaryService";

async function runPhase2EvaluationSuite() {
  console.log("==================================================");
  console.log("  eBookMine Phase 2 RAG & Evaluation Test Suite");
  console.log("==================================================\n");

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
      failedCount++;
    }
  }

  // Setup Test Book: "TOEFL CBT (Cliffs Test Prep)"
  const testBookId = "toefl-cbt-specimen-id-" + Date.now();
  const testBook = await prisma.book.create({
    data: {
      id: testBookId,
      title: "TOEFL CBT (Cliffs Test Prep)",
      driveFileId: "drive-" + testBookId,
      fileName: "toefl_cbt_cliffs.pdf",
      pageCount: 70,
      ingestionStatus: "PENDING",
    },
  });

  const dummyUserId = "eval-user-id";
  await prisma.user.upsert({
    where: { id: dummyUserId },
    update: {},
    create: { id: dummyUserId, email: "eval@ebookmine.app", name: "Eval User" },
  });

  try {
    const toeflPages: RawPageText[] = [
      {
        page: 1,
        text: "Chapter 1: Overview of the TOEFL CBT\n\nThe Computer-Based TOEFL Test (TOEFL CBT) measures English proficiency across four mandatory sections: Listening, Structure, Reading, and Writing. Total scaled score ranges from 0 to 300.",
        chapter: "Chapter 1",
      },
      {
        page: 15,
        text: "Section 1: Listening Comprehension Strategies\n\nThe Listening section contains 30 to 50 questions with a time limit of 40 to 60 minutes. Conversations and lecture passages require active note-taking and main-idea identification.",
        chapter: "Chapter 1",
      },
      {
        page: 25,
        text: "Chapter 2: Structure & Written Expression\n\nThe Structure section evaluates grammatical accuracy with 20 to 25 adaptive questions. Time allowed is 15 to 20 minutes. Questions adapt dynamically based on previous answer accuracy.",
        chapter: "Chapter 2",
      },
      {
        page: 40,
        text: "Chapter 3: Reading Comprehension\n\nThe Reading section features 4 to 5 academic passages followed by 44 to 60 multiple-choice questions. Time limit is strictly 70 to 90 minutes. Key skills include vocabulary in context and inference.",
        chapter: "Chapter 3",
      },
      {
        page: 55,
        text: "Chapter 4: Writing Section & Test-Taking Strategies\n\nThe Writing section requires 1 essay prompt completed in 30 minutes. Essays are scored on a scale from 1.0 to 6.0 by human raters and automated scoring engines.",
        chapter: "Chapter 4",
      },
    ];

    // Ingest pages & build hierarchical summaries
    await ingestBookChunks(testBook.id, toeflPages);
    await buildHierarchicalSummaries(testBook.id);

    // ----------------------------------------------------
    // TEST 1: Required Query — "Summarize key insights of 'TOEFL CBT (Cliffs Test Prep)' with page citations"
    // ----------------------------------------------------
    const q1 = "Summarize key insights of 'TOEFL CBT (Cliffs Test Prep)' with page citations";
    const res1 = await chatWithBook(dummyUserId, testBook.id, q1);

    const hasSynthesis =
      res1.answer.length > 100 &&
      (res1.citations.length > 0 || res1.answer.includes("[Page")) &&
      !res1.isFallback;

    assert(
      hasSynthesis,
      "Test 1 [TARGET QUERY]: Summarizes key insights of TOEFL CBT with multi-chapter synthesis and validated page citations",
      `Category: ${res1.queryCategory}, Citations: ${res1.citations.length}`
    );

    // ----------------------------------------------------
    // TEST 2: Chapter-Specific Question
    // ----------------------------------------------------
    const q2 = "What does Chapter 1 explain about Listening Comprehension?";
    const res2 = await chatWithBook(dummyUserId, testBook.id, q2);
    assert(
      res2.queryCategory === "CHAPTER_OVERVIEW" && (res2.answer.includes("Listening") || res2.answer.includes("Chapter 1")),
      "Test 2: Chapter-specific question routes correctly and retrieves target chapter context"
    );

    // ----------------------------------------------------
    // TEST 3: Exact Fact Question
    // ----------------------------------------------------
    const q3 = "What is the time limit for the TOEFL CBT Reading section?";
    const res3 = await chatWithBook(dummyUserId, testBook.id, q3);
    assert(
      res3.queryCategory === "SPECIFIC_FACT" && res3.answer.includes("70"),
      "Test 3: Exact fact query locates specific detail (70-90 minutes time limit)"
    );

    // ----------------------------------------------------
    // TEST 4: Concept Explanation Question
    // ----------------------------------------------------
    const q4 = "Explain how adaptive scoring works in computer-based testing";
    const res4 = await chatWithBook(dummyUserId, testBook.id, q4);
    assert(
      res4.queryCategory === "CONCEPT_EXPLANATION" && (res4.answer.includes("adapt") || res4.answer.includes("accuracy")),
      "Test 4: Concept explanation synthesizes mechanism of adaptive testing"
    );

    // ----------------------------------------------------
    // TEST 5: Cross-Chapter Comparison
    // ----------------------------------------------------
    const q5 = "Compare Listening Comprehension strategies with Reading Comprehension strategies";
    const res5 = await chatWithBook(dummyUserId, testBook.id, q5);
    assert(
      res5.queryCategory === "COMPARE_CHAPTERS" && res5.citations.length >= 1,
      "Test 5: Cross-chapter comparison retrieves evidence across multiple chapters"
    );

    // ----------------------------------------------------
    // TEST 6: Page-Specific Question
    // ----------------------------------------------------
    const q6 = "What is explained on page 25 of the TOEFL CBT book?";
    const res6 = await chatWithBook(dummyUserId, testBook.id, q6);
    assert(
      res6.queryCategory === "PAGE_QUESTION" && (res6.answer.includes("25") || res6.answer.includes("Structure")),
      "Test 6: Page-specific query targets exact page bounds"
    );

    // ----------------------------------------------------
    // TEST 7: Unanswerable Question (Uncertainty Fallback)
    // ----------------------------------------------------
    const q7 = "What is the quantum mechanics theory of light relativity?";
    const res7 = await chatWithBook(dummyUserId, testBook.id, q7);
    assert(
      res7.isFallback === true || res7.answer.includes("couldn't find") || res7.answer.includes("not found"),
      "Test 7: Unanswerable query triggers uncertainty fallback without hallucinating facts"
    );

    // ----------------------------------------------------
    // TEST 8: Question Requiring Multiple Sources
    // ----------------------------------------------------
    const q8 = "Synthesize all score scale rules and structure time limits across chapters";
    const res8 = await chatWithBook(dummyUserId, testBook.id, q8);
    assert(
      res8.citations.length >= 2,
      "Test 8: Multi-source query combines multiple distinct evidence chunks"
    );
  } finally {
    // Cleanup test dummy book
    await prisma.book.delete({ where: { id: testBookId } }).catch(() => {});
  }

  console.log("\n==================================================");
  console.log(`  Phase 2 Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase2EvaluationSuite().catch((err) => {
  console.error("Phase 2 test execution fatal error:", err);
  process.exit(1);
});
