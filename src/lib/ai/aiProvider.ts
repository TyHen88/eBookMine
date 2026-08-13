export interface BookContext {
  bookTitle?: string;
  author?: string;
  page?: number;
  selectedText?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIProvider {
  /**
   * Generates text response for a given prompt and book context.
   */
  generateText(prompt: string, context?: BookContext): Promise<string>;

  /**
   * Generates a concise summary for selected text or page.
   */
  generateSummary(text: string, context?: BookContext): Promise<string>;

  /**
   * Generates interactive multiple-choice quiz questions.
   */
  generateQuiz(text: string, count?: number): Promise<QuizQuestion[]>;

  /**
   * Generates flashcards for memory retention.
   */
  generateFlashcards(text: string): Promise<Flashcard[]>;

  /**
   * Answers a user's question about the book based on conversation history and current context.
   */
  answerBookQuestion(
    question: string,
    history: ChatHistoryMessage[],
    context?: BookContext
  ): Promise<string>;

  /**
   * Generates a vector embedding for text.
   */
  generateEmbedding(text: string): Promise<number[]>;
}
