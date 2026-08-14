import { aiProvider, checkAndTrackUsage, getOrCreateConversation, saveAiMessage } from "@/lib/ai/aiService";
import { classifyAndRouteQuery } from "./queryRouter";
import { hybridRetrieveChunks } from "./hybridRetriever";
import { buildHierarchicalSummaries, getHierarchicalSummaries } from "./summaryService";
import { buildStructuredContext } from "./contextBuilder";
import { validateAndResolveCitations, CitationItem } from "./citationValidator";
import { requireBookAccess } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";

export interface RagResponse {
  answer: string;
  sources: Array<{ chapter?: string | null; page: number; snippet: string }>;
  citations: CitationItem[];
  queryCategory: string;
  conversationId: string;
  isFallback?: boolean;
}

/**
 * Advanced Phase 2 RAG Pipeline:
 * Query Classification -> Hybrid Search & Diversity Reranking -> Persistent Summaries -> Grounded Synthesis -> Backend Citation Validation
 */
export async function chatWithBook(
  userId: string,
  bookId: string,
  question: string,
  pageContext?: number,
  authorPersonaEnabled = false
): Promise<RagResponse> {
  // 1. Authorization & Usage Check
  const accessResponse = await requireBookAccess(bookId);
  if (!accessResponse.allowed) {
    throw new Error("Unauthorized to access this book");
  }

  await checkAndTrackUsage(userId, "rag_chat", 400);

  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
    include: { authors: { include: { author: true } } },
  });

  if (!book) {
    throw new Error("Book not found");
  }

  const authorName =
    book.authors && book.authors.length > 0
      ? book.authors.map((ba) => ba.author?.name).filter(Boolean).join(", ")
      : undefined;

  // 2. Query Classification & Router Strategy
  const strategy = classifyAndRouteQuery(question);

  // 3. Hierarchical Summaries
  let summaries = await getHierarchicalSummaries(book.id);
  if (summaries.length === 0 && strategy.useHierarchicalSummaries) {
    summaries = await buildHierarchicalSummaries(book.id).catch(() => []);
  }

  // 4. Hybrid Search Engine (pgvector + FTS + Metadata filters + Diversity Reranking)
  const retrievedChunks = await hybridRetrieveChunks(book.id, question, strategy);

  // Fallback Check for Low Confidence / Empty Evidence
  if (retrievedChunks.length === 0 && summaries.length === 0) {
    const fallbackAnswer = "I couldn't find enough evidence in the available book content to answer this reliably.";
    const conversation = await getOrCreateConversation(userId, book.id);
    await saveAiMessage(conversation.id, "user", question, pageContext);
    await saveAiMessage(conversation.id, "assistant", fallbackAnswer, pageContext);

    return {
      answer: fallbackAnswer,
      sources: [],
      citations: [],
      queryCategory: strategy.category,
      conversationId: conversation.id,
      isFallback: true,
    };
  }

  // 5. Structured Context Builder
  const { promptText, sourceMap } = buildStructuredContext({
    bookTitle: book.title,
    authorName,
    pageContext,
    summaries,
    chunks: retrievedChunks,
    strategy,
  });

  // 6. Grounded System Prompt Directives
  const systemDirectives = `STRICT GROUNDED BOOK ANSWERING DIRECTIVES:
1. Grounding: Answer strictly using the provided book evidence sources and summaries. Do not invent facts, statistics, or quotes.
2. Persona: ${authorPersonaEnabled ? `Adopt the author persona (${authorName || "author"}) in first person.` : "You are an AI research assistant analyzing the provided book. Use a neutral, articulate research-assistant voice."}
3. Citation Rule: Reference source IDs as JSON array under 'sources' key, e.g.: {"answer": "...", "sources": ["chunk_123", "chunk_456"]}.
4. Insufficient Evidence: If evidence is incomplete or partial, state clearly: "Based on the available sections..." or "I couldn't find complete evidence..."
5. Synthesis: For overview questions, synthesize key themes across chapters rather than listing topics.`;

  const fullPrompt = `${promptText}\n\n${systemDirectives}\n\nUser Question: "${question}"`;

  const conversation = await getOrCreateConversation(userId, book.id);
  await saveAiMessage(conversation.id, "user", question, pageContext);

  // 7. LLM Reasoning Execution
  const rawLlmReply = await aiProvider.generateText(fullPrompt, {
    bookTitle: book.title,
    page: pageContext,
    author: authorPersonaEnabled ? authorName : undefined,
  });

  // 8. Backend Citation Validation & Resolution
  const validated = await validateAndResolveCitations(book.id, rawLlmReply);

  // Fallback map legacy sources format for frontend compatibility
  const legacySources = validated.citations.map((c) => ({
    chapter: c.chapterTitle,
    page: c.pageStart,
    snippet: c.snippet,
  }));

  await saveAiMessage(conversation.id, "assistant", validated.answer, pageContext);

  return {
    answer: validated.answer,
    sources: legacySources,
    citations: validated.citations,
    queryCategory: strategy.category,
    conversationId: conversation.id,
    isFallback: false,
  };
}
