import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { EmbeddingResult } from "./embeddingService";
import { logger } from "@/lib/logger";

// In-memory LRU cache for ultra-fast in-process lookups
const MEMORY_CACHE = new Map<string, { vector: number[]; expiresAt: number }>();
const MEMORY_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_MEMORY_ENTRIES = 1000;

let tableEnsured = false;

/**
 * Ensure EmbeddingCache table and indexes exist in PostgreSQL without dropping raw vector columns.
 */
export async function ensureEmbeddingCacheTable(): Promise<void> {
  if (tableEnsured) return;
  tableEnsured = true;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EmbeddingCache" (
        "id" TEXT NOT NULL,
        "contentHash" TEXT NOT NULL,
        "model" TEXT NOT NULL,
        "dimensions" INTEGER NOT NULL DEFAULT 64,
        "vectorJson" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EmbeddingCache_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EmbeddingCache_contentHash_key" ON "EmbeddingCache"("contentHash")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmbeddingCache_contentHash_idx" ON "EmbeddingCache"("contentHash")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmbeddingCache_model_dimensions_idx" ON "EmbeddingCache"("model", "dimensions")`);
  } catch (err) {
    logger.warn("[EmbeddingCache] Table setup check:", { error: String(err) });
  }
}

/**
 * Generates deterministic cache key for text, model, and dimension.
 */
export function computeEmbeddingKey(text: string, model: string, dimensions: number): string {
  const normalized = text.trim();
  return createHash("sha256")
    .update(`${model}:${dimensions}:${normalized}`)
    .digest("hex");
}

/**
 * Retrieve cached embedding from memory or database.
 */
export async function getCachedEmbedding(
  text: string,
  model: string,
  dimensions: number
): Promise<number[] | null> {
  const key = computeEmbeddingKey(text, model, dimensions);

  // 1. Check in-memory cache
  const mem = MEMORY_CACHE.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.vector;
  }

  await ensureEmbeddingCacheTable();

  // 2. Check PostgreSQL EmbeddingCache table
  try {
    const record = await prisma.embeddingCache.findUnique({
      where: { contentHash: key },
      select: { vectorJson: true },
    });

    if (record?.vectorJson) {
      const vector: number[] = JSON.parse(record.vectorJson);
      if (Array.isArray(vector) && vector.length === dimensions) {
        // Populate memory cache
        if (MEMORY_CACHE.size >= MAX_MEMORY_ENTRIES) {
          const oldestKey = MEMORY_CACHE.keys().next().value;
          if (oldestKey) MEMORY_CACHE.delete(oldestKey);
        }
        MEMORY_CACHE.set(key, { vector, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS });
        return vector;
      }
    }
  } catch (err) {
    logger.warn("[EmbeddingCache] Database cache lookup failed:", { error: String(err) });
  }

  return null;
}

/**
 * Save newly generated embedding to both in-memory and PostgreSQL caches.
 */
export async function setCachedEmbedding(
  text: string,
  model: string,
  dimensions: number,
  vector: number[]
): Promise<void> {
  const key = computeEmbeddingKey(text, model, dimensions);

  // 1. Update in-memory cache
  if (MEMORY_CACHE.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = MEMORY_CACHE.keys().next().value;
    if (oldestKey) MEMORY_CACHE.delete(oldestKey);
  }
  MEMORY_CACHE.set(key, { vector, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS });

  await ensureEmbeddingCacheTable();

  // 2. Upsert into PostgreSQL table
  try {
    await prisma.embeddingCache.upsert({
      where: { contentHash: key },
      create: {
        contentHash: key,
        model,
        dimensions,
        vectorJson: JSON.stringify(vector),
      },
      update: {
        vectorJson: JSON.stringify(vector),
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn("[EmbeddingCache] Database cache write failed:", { error: String(err) });
  }
}

/**
 * Cache-aware embedding wrapper. Returns cached vector if present; otherwise calls embedder.
 */
export async function embedWithCache(
  text: string,
  generateFn: (text: string) => Promise<EmbeddingResult>
): Promise<EmbeddingResult> {
  const cleanText = text.trim();
  if (!cleanText) {
    return generateFn(text);
  }

  // Probe with default or synthetic model metadata
  const cached = await getCachedEmbedding(cleanText, "default", 64);
  if (cached) {
    return {
      vector: cached,
      model: "cached",
      dimensions: cached.length,
      provider: "cache",
    };
  }

  // Generate via underlying embedding provider
  const result = await generateFn(cleanText);

  // Store in cache asynchronously
  if (result.vector && result.vector.length > 0) {
    setCachedEmbedding(cleanText, result.model, result.dimensions, result.vector).catch(() => {});
  }

  return result;
}
