import { z } from "zod";

export const bookCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  driveFileId: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  published: z.boolean().optional(),
});

export const bookUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  published: z.boolean().optional(),
});

export const aiChatSchema = z.object({
  bookId: z.string().optional(),
  page: z.number().optional(),
  selectedText: z.string().optional(),
  message: z.string().optional(),
  prompt: z.string().optional(),
  bookTitle: z.string().optional(),
  author: z.string().optional(),
  chatHistory: z.array(z.any()).optional(),
});

export const quizSubmitSchema = z.object({
  quizId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      userAnswer: z.string(),
    })
  ),
});

export const flashcardReviewSchema = z.object({
  cardId: z.string().min(1),
  rating: z.number().min(1).max(4),
});

export const goalSchema = z.object({
  type: z.enum([
    "daily_minutes",
    "daily_pages",
    "weekly_pages",
    "monthly_books",
    "yearly_books",
  ]),
  target: z.number().min(1),
  period: z.string().optional(),
});
