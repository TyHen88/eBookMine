import { prisma } from "../src/lib/db";
import { ingestBookChunks, getIngestionStatus } from "../src/lib/rag/ingestionService";
import { generateEmbedding, getEmbeddingConfig, isEmbeddingStale } from "../src/lib/ai/embeddingService";
import { processDocumentContent, RawPageText } from "../src/lib/rag/chunker";
import { retrieveRelevantChunks } from "../src/lib/rag/retriever";

async function runPhase1TestSuite() {
  console.log("==================================================");
  console.log("  eBookMine Phase 1 Document Intelligence Test Suite");
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

  // Setup test dummy book in DB
  const testBookId = "test-phase1-book-id-" + Date.now();
  const testBook = await prisma.book.create({
    data: {
      id: testBookId,
      title: "Phase 1 Automated Test Specimen",
      driveFileId: "drive-" + testBookId,
      fileName: "test_specimen.pdf",
      pageCount: 3,
      ingestionStatus: "PENDING",
    },
  });

  try {
    // ----------------------------------------------------
    // TEST 1: PDF with Normal Text Processing
    // ----------------------------------------------------
    const normalDocPages: RawPageText[] = [
      {
        page: 1,
        text: "Chapter 1: Foundations of Artificial Intelligence\n\nArtificial intelligence is transforming software engineering. Deep learning and neural networks provide representation capabilities.",
        chapter: "Chapter 1",
      },
    ];

    const result1 = await ingestBookChunks(testBook.id, normalDocPages);
    assert(
      result1.status === "COMPLETED" && result1.chunkCount > 0,
      "Test 1: Normal text document ingestion completed cleanly",
      `Status: ${result1.status}, Chunk count: ${result1.chunkCount}`
    );

    // ----------------------------------------------------
    // TEST 2: Multi-Page Document Processing
    // ----------------------------------------------------
    const multiDocPages: RawPageText[] = [
      {
        page: 1,
        text: "Chapter 1: Introduction to Distributed Systems\n\nDistributed systems involve multiple autonomous computing nodes that communicate over network protocols.",
        chapter: "Chapter 1",
      },
      {
        page: 2,
        text: "Section 1.1: Consensus Protocols\n\nConsensus protocols like Paxos and Raft ensure agreement across replicated state machines despite node failures.",
        chapter: "Chapter 1",
      },
      {
        page: 3,
        text: "Chapter 2: Data Replication & Fault Tolerance\n\nReplication strategies trade off consistency for availability under network partitions according to the CAP theorem.",
        chapter: "Chapter 2",
      },
    ];

    const result2 = await ingestBookChunks(testBook.id, multiDocPages);
    assert(
      result2.status === "COMPLETED" && result2.pageCount === 3 && result2.chunkCount >= 3,
      "Test 2: Multi-page document ingested with structural breakdown",
      `Pages: ${result2.pageCount}, Chunks: ${result2.chunkCount}`
    );

    // ----------------------------------------------------
    // TEST 3: Repeated Ingestion (Idempotency)
    // ----------------------------------------------------
    const result3 = await ingestBookChunks(testBook.id, multiDocPages);
    assert(
      result3.skipped === true && result3.status === "COMPLETED",
      "Test 3: Idempotent ingestion reuses existing processed data without duplication",
      `Skipped: ${result3.skipped}`
    );

    // ----------------------------------------------------
    // TEST 4: Changed PDF Document Reprocessing
    // ----------------------------------------------------
    const modifiedDocPages: RawPageText[] = [
      ...multiDocPages,
      {
        page: 4,
        text: "Chapter 3: Modern Vector Databases\n\nVector databases leverage high-dimensional indexing such as HNSW and IVF-PQ for sub-millisecond similarity search.",
        chapter: "Chapter 3",
      },
    ];

    const result4 = await ingestBookChunks(testBook.id, modifiedDocPages);
    assert(
      result4.skipped === false && result4.pageCount === 4,
      "Test 4: Modified PDF document invalidates stale data and re-processes cleanly",
      `Skipped: ${result4.skipped}, New page count: ${result4.pageCount}`
    );

    // ----------------------------------------------------
    // TEST 5: Page Provenance Verification
    // ----------------------------------------------------
    const dbPages = await prisma.documentPage.findMany({
      where: { bookId: testBook.id },
      orderBy: { pageNumber: "asc" },
    });

    const pageProvenanceValid =
      dbPages.length === 4 &&
      dbPages[0].pageNumber === 1 &&
      dbPages[3].pageNumber === 4 &&
      dbPages[0].text.includes("Distributed Systems");

    assert(
      pageProvenanceValid,
      "Test 5: Page-level provenance accurately maps to original PDF page numbers and text",
      `Count: ${dbPages.length}`
    );

    // ----------------------------------------------------
    // TEST 6: Content Chunk Provenance Verification
    // ----------------------------------------------------
    const dbChunks = await prisma.contentChunk.findMany({
      where: { bookId: testBook.id },
      orderBy: { chunkIndex: "asc" },
    });

    const chunkProvenanceValid =
      dbChunks.length > 0 &&
      dbChunks.every(
        (c) =>
          c.pageStart >= 1 &&
          c.pageEnd >= c.pageStart &&
          c.chunkIndex >= 0 &&
          c.tokenCount > 0 &&
          c.contentHash !== null
      );

    assert(
      chunkProvenanceValid,
      "Test 6: ContentChunk records contain complete provenance metadata (pageStart, pageEnd, chunkIndex, tokenCount, contentHash)",
      `Sample chunk pageStart: ${dbChunks[0]?.pageStart}, tokenCount: ${dbChunks[0]?.tokenCount}`
    );

    // ----------------------------------------------------
    // TEST 7: Embedding Dimension Validation
    // ----------------------------------------------------
    let dimensionValidationPassed = false;
    try {
      const { validateEmbeddingDimensions } = await import("../src/lib/ai/embeddingService");
      // Pass vector of length 32 when expected dimension is 64
      validateEmbeddingDimensions(new Array(32).fill(0.1), 64);
    } catch (err: any) {
      if (err.message.includes("dimension mismatch")) {
        dimensionValidationPassed = true;
      }
    }

    assert(
      dimensionValidationPassed,
      "Test 7: Embedding service strictly validates vector dimensions and rejects mismatches"
    );

    // ----------------------------------------------------
    // TEST 8: Failed Ingestion Handling
    // ----------------------------------------------------
    const badBookId = "bad-book-id-invalid";
    let failedStatusHandled = false;
    try {
      await ingestBookChunks(badBookId, normalDocPages);
    } catch {
      failedStatusHandled = true;
    }
    assert(
      failedStatusHandled,
      "Test 8: Failed ingestion logs error and halts pipeline safely"
    );

    // ----------------------------------------------------
    // TEST 9: Partial Processing / Retry Recovery
    // ----------------------------------------------------
    // Set book status to FAILED manually
    await prisma.book.update({
      where: { id: testBook.id },
      data: { ingestionStatus: "FAILED", ingestionError: "Simulated previous failure" },
    });

    const result9 = await ingestBookChunks(testBook.id, multiDocPages);
    assert(
      result9.status === "COMPLETED" && result9.chunkCount > 0,
      "Test 9: Ingestion pipeline recovers and completes successfully after previous failure state",
      `Status: ${result9.status}`
    );

    // Test Retrieval on non-stale chunks
    const retrieved = await retrieveRelevantChunks(testBook.id, "Consensus Protocols", 5);
    assert(
      retrieved.some((r) => r.content.includes("Consensus")),
      "Bonus: RAG Retriever retrieves non-stale chunks with provenance metadata"
    );
  } finally {
    // Cleanup test dummy book
    await prisma.book.delete({ where: { id: testBook.id } }).catch(() => {});
  }

  console.log("\n==================================================");
  console.log(`  Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase1TestSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
