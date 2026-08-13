import { prisma } from "@/lib/db";
import { getAIConfig } from "@/lib/aiConfig";
import {
  AIProvider,
  BookContext,
  ChatHistoryMessage,
  QuizQuestion,
  Flashcard,
} from "./aiProvider";
import { retrieveRelevantChunks } from "@/lib/rag/retriever";

export class DefaultAIProvider implements AIProvider {
  private buildSystemPrompt(basePrompt: string, context?: BookContext): string {
    const hasAuthor = context?.author && context.author !== "Unknown";

    let ctx =
      basePrompt ||
      (hasAuthor
        ? `You are ${context.author}, the author of "${context.bookTitle}". You respond to questions as if you personally wrote the book — speaking in the first person ("I wrote…", "In my book…", "My intention was…"). Draw from the book's content, themes, and ideas to answer as the author would. Be knowledgeable, articulate, and true to the book's voice and perspective.`
        : "You are eBookMine AI Assistant — an intelligent book companion that deeply understands the content of the book the reader is studying.");

    ctx += `\n\nCORE RESPONSE QUALITY DIRECTIVES:
1. ACCURACY & MEANING: Ensure answers are 100% accurate, meaningful, and directly grounded in the text. Do not hallucinate or off-topic chatter.
2. BALANCED LENGTH: Keep responses focused and well-proportioned (120–250 words). Avoid superficial 1-sentence answers and avoid overwhelming walls of text.
3. STRUCTURED FORMATTING: Use clean Markdown (### Headings, **Bold Key Terms**, • Bullet Points).
4. ${hasAuthor ? `AUTHOR PERSPECTIVE: Stay in character as the author (${context.author}) using first-person voice.` : "DOCUMENT ANALYSIS: Synthesize key ideas with precision and clarity."}
5. PAGE CITATIONS: Include page references as [Page X] when citing concepts or quotes from the book.
6. NO BACKEND MENTIONS: Never mention Google Drive, personal drive, or database details to the user. Refer to the reader's space simply as eBookMine Library.`;

    if (context?.bookTitle) ctx += `\nActive Book Title: "${context.bookTitle}".`;
    if (hasAuthor) ctx += `\nAuthor Identity: ${context.author} (respond as this person).`;
    if (context?.page) ctx += `\nCurrent Reader Location: Page ${context.page}.`;
    if (context?.selectedText) ctx += `\nHighlighted Excerpt: "${context.selectedText}".`;

    return ctx;
  }

  private async callLlm(prompt: string, context?: BookContext): Promise<string> {
    const config = await getAIConfig();
    const apiKey = (config.apiKey || process.env.AI_API_KEY || "").trim();
    const model = config.model || process.env.AI_MODEL || "google/gemini-2.5-flash";
    const provider = config.provider || "openrouter";

    if (!apiKey && provider !== "ollama") {
      throw new Error(
        "Missing AI API Key. Please open Admin Panel → AI Settings to enter your API key."
      );
    }

    let endpoint = "https://openrouter.ai/api/v1/chat/completions";
    let fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ebookmine.app",
      "X-Title": "eBookMine Reader",
    };

    let requestBody: any = {
      model,
      temperature: config.temperature || 0.7,
      messages: [
        { role: "system", content: this.buildSystemPrompt(config.systemPrompt, context) },
        { role: "user", content: prompt },
      ],
    };

    if (provider === "openai") {
      endpoint = "https://api.openai.com/v1/chat/completions";
      fetchHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (provider === "google") {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      delete fetchHeaders["Authorization"];
      requestBody = {
        contents: [
          {
            parts: [
              { text: this.buildSystemPrompt(config.systemPrompt, context) + "\n\n" + prompt },
            ],
          },
        ],
      };
    } else if (provider === "ollama") {
      endpoint = "http://localhost:11434/api/generate";
      delete fetchHeaders["Authorization"];
      requestBody = {
        model,
        prompt: this.buildSystemPrompt(config.systemPrompt, context) + "\n\n" + prompt,
        stream: false,
      };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errDetail =
        errData.error?.message ||
        errData.message ||
        (res.status === 401
          ? "HTTP 401 Unauthorized — Invalid API Key. Check API Key in Admin Panel."
          : `HTTP ${res.status}`);

      throw new Error(`AI Provider Call Error: ${errDetail}`);
    }

    const data = await res.json();

    if (provider === "google") {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } else if (provider === "ollama") {
      if (data.response) return data.response;
    } else {
      const reply = data.choices?.[0]?.message?.content;
      if (reply) return reply;
    }

    return "No text generated by provider.";
  }

  async generateText(prompt: string, context?: BookContext): Promise<string> {
    return this.callLlm(prompt, context);
  }

  async generateSummary(text: string, context?: BookContext): Promise<string> {
    return this.callLlm(`Summarize the following passage clearly with page citations:\n\n${text}`, context);
  }

  async generateQuiz(text: string, count = 5): Promise<QuizQuestion[]> {
    const prompt = `Based on the following book text, generate ${count} high-quality multiple-choice quiz questions to test reading comprehension.

BOOK TEXT:
"${text.substring(0, 3000)}"

Respond ONLY with a JSON array of objects matching this exact structure:
[
  {
    "question": "Question text?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "answer": "Option 1",
    "explanation": "Detailed explanation of why this answer is correct."
  }
]`;

    try {
      const rawRes = await this.callLlm(prompt);
      const jsonMatch = rawRes.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, count).map((q: any) => ({
            question: String(q.question || "What is the key takeaway?"),
            options: Array.isArray(q.options) && q.options.length >= 2
              ? q.options.map(String)
              : ["Option A", "Option B", "Option C", "Option D"],
            answer: String(q.answer || q.options?.[0] || "Option A"),
            explanation: String(q.explanation || "Correct answer based on book content."),
          }));
        }
      }
    } catch (err) {
      console.warn("[AIService] Real quiz generation fallback:", err);
    }

    return [
      {
        question: `What is the central concept discussed in "${text.substring(0, 40)}..."?`,
        options: [
          "Core principles and logical structure",
          "Historical background timeline",
          "Unrelated analytical methodology",
          "Statistical empirical outliers",
        ],
        answer: "Core principles and logical structure",
        explanation: "The passage introduces key foundational concepts.",
      },
    ];
  }

  async generateFlashcards(text: string): Promise<Flashcard[]> {
    return [
      {
        front: "What is the primary concept on this page?",
        back: text.substring(0, 100) + "...",
      },
    ];
  }

  async answerBookQuestion(
    question: string,
    history: ChatHistoryMessage[],
    context?: BookContext
  ): Promise<string> {
    // Retrieve multi-page chunks from PostgreSQL if book is specified
    let ragContext = "";
    if (context?.bookTitle) {
      try {
        const chunks = await retrieveRelevantChunks(context.bookTitle, question, 5);
        if (chunks.length > 0) {
          const pageCitations = Array.from(new Set(chunks.map((c) => c.page))).sort((a, b) => a - b);
          ragContext = `\nRetrieved Multi-Page Context (Pages: ${pageCitations.map((p) => `Page ${p}`).join(", ")}):\n` +
            chunks.map((c) => `[Page ${c.page}]: "${c.content}"`).join("\n\n");
        }
      } catch {
        /* fallback */
      }
    }

    const historyText = history
      .slice(-4)
      .map((h) => `${h.role}: ${h.content}`)
      .join("\n");

    const prompt = `Conversation History:\n${historyText}\n${ragContext}\n\nUser Question: ${question}`;
    return this.callLlm(prompt, context);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const vector = new Array(64).fill(0).map((_, i) => Math.sin(i + text.length));
    return vector;
  }
}

// Global Singleton Provider Instance
export const aiProvider = new DefaultAIProvider();

/**
 * Check daily rate limit and track AI usage in PostgreSQL.
 */
export async function checkAndTrackUsage(
  userId: string,
  action: string,
  estimatedTokens = 250
): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usageRecords = await prisma.aIUsage.findMany({
    where: { userId, createdAt: { gte: since } },
  });

  const config = await getAIConfig();
  const limit = config.dailyTokenLimit || 100000;
  const totalTokens = usageRecords.reduce((sum, u) => sum + u.tokens, 0);
  if (totalTokens >= limit) {
    throw new Error(`Daily AI usage limit reached (${limit.toLocaleString()} tokens/day). Please try again tomorrow.`);
  }

  await prisma.aIUsage.create({
    data: {
      userId,
      action,
      tokens: estimatedTokens,
    },
  });
}

/**
 * Retrieve or create an active AI Conversation for user and book.
 * Safely resolves bookId (whether passed as PostgreSQL ID or driveFileId) to the Book primary key.
 */
export async function getOrCreateConversation(
  userId: string,
  bookId?: string
) {
  let resolvedBookId: string | null = null;
  if (bookId && bookId.trim()) {
    const dbBook = await prisma.book.findFirst({
      where: {
        OR: [{ id: bookId.trim() }, { driveFileId: bookId.trim() }],
      },
      select: { id: true },
    }).catch(() => null);

    if (dbBook) {
      resolvedBookId = dbBook.id;
    }
  }

  let conversation = await prisma.aIConversation.findFirst({
    where: {
      userId,
      bookId: resolvedBookId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.aIConversation.create({
      data: {
        userId,
        bookId: resolvedBookId,
        title: resolvedBookId ? "Book Discussion" : "General Tutor",
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  return conversation;
}

/**
 * Save a message in the active AI Conversation.
 */
export async function saveAiMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  page?: number,
  selectedText?: string
) {
  return prisma.aIMessage.create({
    data: {
      conversationId,
      role,
      content,
      page,
      selectedText,
    },
  });
}

/**
 * Clear all messages in a conversation.
 */
export async function clearConversationHistory(
  userId: string,
  conversationId: string
) {
  const conversation = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) return false;

  await prisma.aIMessage.deleteMany({
    where: { conversationId },
  });

  return true;
}
