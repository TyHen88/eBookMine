import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";

export interface AIConfigData {
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  chunkSize: number;
  chunkOverlap: number;
  dailyTokenLimit: number;
  temperature: number;
}

const DEFAULT_CONFIG: AIConfigData = {
  provider: process.env.AI_PROVIDER || "openrouter",
  model: process.env.AI_MODEL || "google/gemini-2.5-flash",
  apiKey: process.env.AI_API_KEY || "",
  systemPrompt:
    "You are eBookMine AI Tutor, an intelligent reading and study companion. Answer questions concisely using vector chunks and book context.",
  chunkSize: 500,
  chunkOverlap: 50,
  dailyTokenLimit: 100000,
  temperature: 0.7,
};

const CONFIG_FILE_PATH = path.join(process.cwd(), ".gemini", "ai-config.json");

// In-memory cache for fast sync access
let cachedConfig: AIConfigData | null = null;

/**
 * Load active AI configuration from DB or JSON file fallback or env defaults.
 */
export async function getAIConfig(): Promise<AIConfigData> {
  if (cachedConfig) return cachedConfig;

  try {
    // Try reading from database SystemSetting table with optional chaining safety
    if ((prisma as any).systemSetting) {
      const dbRecord = await (prisma as any).systemSetting.findUnique({
        where: { key: "AI_CONFIG" },
      });
      if (dbRecord && dbRecord.value) {
        const parsed = JSON.parse(dbRecord.value);
        const res: AIConfigData = { ...DEFAULT_CONFIG, ...parsed };
        cachedConfig = res;
        return res;
      }
    }
  } catch {
    /* fallback to file or defaults */
  }

  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const fileData = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      const parsed = JSON.parse(fileData);
      const res: AIConfigData = { ...DEFAULT_CONFIG, ...parsed };
      cachedConfig = res;
      return res;
    }
  } catch {
    /* fallback to defaults */
  }

  const res: AIConfigData = { ...DEFAULT_CONFIG };
  cachedConfig = res;
  return res;
}

/**
 * Synchronous getter for background service instances.
 */
export function getAIConfigSync(): AIConfigData {
  if (cachedConfig) return cachedConfig;

  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const fileData = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      const parsed = JSON.parse(fileData);
      const res: AIConfigData = { ...DEFAULT_CONFIG, ...parsed };
      cachedConfig = res;
      return res;
    }
  } catch {
    /* fallback */
  }

  const res: AIConfigData = { ...DEFAULT_CONFIG };
  cachedConfig = res;
  return res;
}

/**
 * Save updated AI configuration to DB and JSON file storage.
 */
export async function saveAIConfig(
  newConfig: Partial<AIConfigData>
): Promise<AIConfigData> {
  const current = await getAIConfig();
  const updated: AIConfigData = {
    ...current,
    ...newConfig,
  };

  cachedConfig = updated;

  // 1. Save to JSON file storage
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save AI config file:", err);
  }

  // 2. Save to DB SystemSetting table safely
  try {
    if ((prisma as any).systemSetting) {
      await (prisma as any).systemSetting.upsert({
        where: { key: "AI_CONFIG" },
        update: { value: JSON.stringify(updated) },
        create: { key: "AI_CONFIG", value: JSON.stringify(updated) },
      });
    }
  } catch (err) {
    console.warn("Could not upsert SystemSetting table:", err);
  }

  return updated;
}
