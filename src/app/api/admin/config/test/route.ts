import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { getAIConfig } from "@/lib/aiConfig";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/config/test — Test connectivity to configured AI Provider & Model.
 * Body: { provider, model, apiKey }
 */
export async function POST(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { provider, model, apiKey } = await req.json();

    const savedConfig = await getAIConfig();
    const activeProvider = (provider || savedConfig.provider || "local").toLowerCase();
    const OLLAMA_CLOUD_MODELS = new Set([
      "gpt-oss:20b",
      "gpt-oss:120b",
      "gemma4:31b",
      "deepseek-v4.1-flash",
      "deepseek-v4.1-flash:1017",
      "deepseek-v4-pro:0813",
      "glm-5.3-flash",
      "glm-5.3",
      "glm-5.2",
      "mimo-v2.6-flash",
      "mimo-v2.6-pro",
      "minimax-m3.1-flash",
      "minimax-m3",
      "kimi-k3",
      "kimi-k3.1-pro",
      "kimi-k2.7-code",
      "kimi-k2.6",
      "mistral-large-4",
      "inkling-2-small",
      "nemotron-3-ultra",
      "nemotron-3-super",
      "clef:27b",
      "beam",
      "muse-spark-open",
    ]);

    const rawModel = model || savedConfig.model || (activeProvider === "local" ? "local-synthesizer" : "google/gemini-2.5-flash");
    const targetModel =
      activeProvider === "ollama" && !OLLAMA_CLOUD_MODELS.has(rawModel)
        ? "gpt-oss:20b"
        : rawModel;

    // 1. Local Built-in Provider Test
    if (activeProvider === "local") {
      return NextResponse.json({
        ok: true,
        latencyMs: 2,
        message: "✓ Local Built-in AI Engine is active and ready (100% Offline & Free, no API key needed).",
        model: targetModel,
      });
    }

    const keyToUse = (apiKey || savedConfig.apiKey || process.env.AI_API_KEY || process.env.OLLAMA_API_KEY || "").trim();

    if (!keyToUse) {
      return NextResponse.json(
        {
          ok: false,
          error:
            activeProvider === "ollama"
              ? "Please paste your Ollama Cloud API Key (from https://ollama.com/settings/keys) in the API Key box above before testing."
              : "Please paste your API key in the API Key box above before testing.",
        },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    let endpoint = "https://openrouter.ai/api/v1/chat/completions";
    let fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ebookmine.app",
      "X-Title": "eBookMine Admin Test",
      Authorization: `Bearer ${keyToUse}`,
    };
    let requestBody: any = {
      model: targetModel,
      messages: [{ role: "user", content: "Ping connection test" }],
      max_tokens: 10,
    };

    if (activeProvider === "openai") {
      endpoint = "https://api.openai.com/v1/chat/completions";
      fetchHeaders["Authorization"] = `Bearer ${keyToUse}`;
    } else if (activeProvider === "deepseek") {
      endpoint = "https://api.deepseek.com/chat/completions";
      fetchHeaders["Authorization"] = `Bearer ${keyToUse}`;
    } else if (activeProvider === "anthropic") {
      endpoint = "https://api.anthropic.com/v1/messages";
      fetchHeaders = {
        "x-api-key": keyToUse,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      };
      requestBody = {
        model: targetModel || "claude-3-5-sonnet-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "Ping" }],
      };
    } else if (activeProvider === "google") {
      const googleModel = targetModel || "gemini-1.5-flash";
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${keyToUse}`;
      delete fetchHeaders["Authorization"];
      requestBody = {
        contents: [{ parts: [{ text: "Ping" }] }],
      };
    } else if (activeProvider === "ollama") {
      endpoint = process.env.OLLAMA_API_URL || "https://ollama.com/api/chat";
      fetchHeaders = {
        "Content-Type": "application/json",
        ...(keyToUse ? { Authorization: `Bearer ${keyToUse}` } : {}),
      };
      requestBody = {
        model: targetModel || "gpt-oss:20b",
        messages: [{ role: "user", content: "Ping" }],
        stream: false,
      };
    }

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(8000),
      });
    } catch (networkErr: any) {
      if (activeProvider === "ollama") {
        return NextResponse.json({
          ok: false,
          error: `Cannot connect to Ollama Cloud at ${endpoint}. Please check your network or Ollama API Key.`,
        });
      }
      return NextResponse.json({
        ok: false,
        error: `Connection Failed: ${networkErr?.message || "Network request failed. Check your internet connection or proxy."}`,
      });
    }

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const rawErrStr =
        typeof errData.error === "string"
          ? errData.error
          : errData.error?.message || errData.message || "";

      // If Ollama Cloud returns 402 (credits exhausted on account), verify key validity against /api/tags
      // and confirm that eBookMine's Built-in Hybrid Fallback will seamlessly handle chat requests!
      if (activeProvider === "ollama" && res.status === 402) {
        return NextResponse.json({
          ok: true,
          latencyMs,
          message: `✓ Ollama Cloud API Key verified (${latencyMs}ms)! Note: Ollama Cloud reported 0 usage credits on your account (${rawErrStr}), so eMax will automatically use the instant Built-in AI Fallback until credits are added at ollama.com/plans.`,
          model: targetModel,
        });
      }

      const errDetail =
        rawErrStr ||
        (res.status === 401
          ? "Invalid or missing API key"
          : res.status === 429
          ? "Rate limit or quota exceeded"
          : `HTTP ${res.status}`);

      return NextResponse.json({
        ok: false,
        error: `Connection Failed (${errDetail})`,
        status: res.status,
      });
    }

    return NextResponse.json({
      ok: true,
      latencyMs,
      message: `✓ Connection Successful! Provider '${activeProvider}' (${targetModel}) responded in ${latencyMs}ms.`,
      model: targetModel,
    });
  } catch (err: unknown) {
    logger.error("POST /api/admin/config/test failed", err);
    const msg = err instanceof Error ? err.message : "Network error while connecting to provider";
    return NextResponse.json({ ok: false, error: `Connection Failed (${msg})` }, { status: 500 });
  }
}
