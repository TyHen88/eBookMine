import { getAIConfig } from "@/lib/aiConfig";
import { embedWithCache } from "./embeddingCache";

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  provider?: string;
}

export interface EmbeddingConfig {
  provider: string;
  model: string;
  dimensions: number;
}

/**
 * Resolve active embedding configuration from environment variables / system defaults.
 */
export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
  const provider = (process.env.EMBEDDING_PROVIDER || "local").toLowerCase();
  const model = process.env.EMBEDDING_MODEL || "synthetic-64";
  const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || "64", 10);

  return {
    provider,
    model,
    dimensions: isNaN(dimensions) || dimensions <= 0 ? 64 : dimensions,
  };
}

/**
 * Validates that vector length matches expected database dimension. Throws error on mismatch.
 */
export function validateEmbeddingDimensions(vector: number[], expectedDimensions: number): void {
  if (vector.length !== expectedDimensions) {
    throw new Error(
      `Embedding dimension mismatch: generated vector length (${vector.length}) does not match configured database dimension (${expectedDimensions}).`
    );
  }
}

/**
 * Generate deterministic synthetic vector embedding for testing / offline mode.
 */
function generateSyntheticEmbedding(text: string, dimensions: number): number[] {
  const vector: number[] = new Array(dimensions);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < dimensions; i++) {
    const val = Math.sin(hash + i * 0.1) * Math.cos(i + text.length);
    vector[i] = parseFloat(val.toFixed(6));
  }
  return vector;
}

/**
 * Direct provider embedding caller without caching.
 */
async function fetchRawEmbedding(text: string): Promise<EmbeddingResult> {
  const config = await getEmbeddingConfig();
  let vector: number[] = [];

  const cleanText = text.trim();

  if (process.env.AI_TEST_MODE === "true" || config.provider === "local") {
    vector = generateSyntheticEmbedding(cleanText, config.dimensions);
    return {
      provider: config.provider,
      model: config.model,
      dimensions: config.dimensions,
      vector,
    };
  }

  if (config.provider === "openai") {
    const aiConfig = await getAIConfig();
    const apiKey = (aiConfig.apiKey || process.env.AI_API_KEY || "").trim();
    if (!apiKey) {
      throw new Error("Missing OpenAI API Key for embedding generation.");
    }

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: cleanText,
        model: config.model || "text-embedding-3-small",
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`OpenAI Embedding API Error: ${errData.error?.message || res.status}`);
    }

    const data = await res.json();
    vector = data.data?.[0]?.embedding || [];
  } else if (config.provider === "ollama") {
    const res = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model || "nomic-embed-text",
        prompt: cleanText,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama Embedding API Error: HTTP ${res.status}`);
    }

    const data = await res.json();
    vector = data.embedding || [];
  } else {
    // Default fallback: Local deterministic synthetic embedding
    vector = generateSyntheticEmbedding(cleanText, config.dimensions);
  }

  // Strict Dimension Validation
  validateEmbeddingDimensions(vector, config.dimensions);

  return {
    provider: config.provider,
    vector,
    model: config.model,
    dimensions: config.dimensions,
  };
}

/**
 * Generate a vector embedding for text with multi-tier memory and database caching.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  return embedWithCache(text, (rawText) => fetchRawEmbedding(rawText));
}

/**
 * Check if an existing chunk's embedding is stale relative to current configuration.
 */
export function isEmbeddingStale(
  currentModel: string,
  currentDim: number,
  chunkModel?: string | null,
  chunkDim?: number | null
): boolean {
  if (!chunkModel || !chunkDim) return true;
  return chunkModel !== currentModel || chunkDim !== currentDim;
}
