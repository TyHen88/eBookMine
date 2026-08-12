import { aiProvider, checkAndTrackUsage, getOrCreateConversation, saveAiMessage } from "@/lib/ai/aiService";
import { retrieveRelevantChunks } from "./retriever";
import { requireBookAccess } from "@/lib/authHelpers";
import { prisma } from "@/lib/db";

export interface RagSource {
  chapter?: string | null;
  page: number;
  snippet: string;
}

export interface RagResponse {
  answer: string;
  sources: RagSource[];
  conversationId: string;
}

/**
 * Perform a book-aware RAG query against retrieved content chunks in PostgreSQL.
 */
export async function chatWithBook(
  userId: string,
  bookId: string,
  question: string,
  pageContext?: number
): Promise<RagResponse> {
  // Authorization check
  const accessResponse = await requireBookAccess(bookId);
  if (accessResponse) {
    throw new Error("Unauthorized to access this book");
  }

  // Rate limiting check
  await checkAndTrackUsage(userId, "rag_chat", 400);

  const book = await prisma.book.findFirst({
    where: { OR: [{ driveFileId: bookId }, { id: bookId }] },
  });

  if (!book) {
    throw new Error("Book not found");
  }

  // Retrieve relevant chunks
  const chunks = await retrieveRelevantChunks(book.id, question, 4);

  let contextPrompt = `Book: "${book.title}"\n`;
  if (pageContext) contextPrompt += `User is currently reading Page ${pageContext}.\n`;

  if (chunks.length === 0) {
    contextPrompt += `\nNo relevant book content chunks were found in the database.`;
  } else {
    contextPrompt += `\nRetrieved Book Content Chunks:\n`;
    chunks.forEach((c, idx) => {
      contextPrompt += `\n[Chunk ${idx + 1}] (Chapter: ${c.chapter || "N/A"}, Page: ${c.page}):\n"${c.content}"\n`;
    });
  }

  const prompt = `${contextPrompt}\n\nUser Question: ${question}\n\nSTRICT ANSWER RULES:\n1. Prioritize retrieved book content above general knowledge.\n2. If the answer cannot be supported by retrieved book content, respond clearly: "The requested information was not found in the book contents."\n3. Do not fabricate citations or facts.`;

  const conversation = await getOrCreateConversation(userId, book.id);
  await saveAiMessage(conversation.id, "user", question, pageContext);

  const answer = await aiProvider.generateText(prompt, {
    bookTitle: book.title,
    page: pageContext,
  });

  const sources: RagSource[] = chunks.map((c) => ({
    chapter: c.chapter || null,
    page: c.page,
    snippet: c.content.substring(0, 120) + "...",
  }));

  await saveAiMessage(conversation.id, "assistant", answer, pageContext);

  return {
    answer,
    sources,
    conversationId: conversation.id,
  };
}
