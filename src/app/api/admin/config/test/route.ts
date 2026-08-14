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
    const targetModel = model || savedConfig.model || (activeProvider === "local" ? "local-synthesizer" : "google/gemini-2.5-flash");

    // 1. Local Built-in Provider Test
    if (activeProvider === "local") {
      return NextResponse.json({
        ok: true,
        latencyMs: 2,
        message: "✓ Local Built-in AI Engine is active and ready (100% Offline & Free, no API key needed).",
        model: targetModel,
      });
    }

    const keyToUse = (apiKey || savedConfig.apiKey || process.env.AI_API_KEY || "").trim();

    if (!keyToUse && activeProvider !== "ollama") {
      return NextResponse.json(
        {
          ok: false,
          error: "Please paste your API key in the API Key box above before testing.",
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
      endpoint = "http://localhost:11434/api/generate";
      delete fetchHeaders["Authorization"];
      requestBody = {
        model: targetModel,
        prompt: "Ping",
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
          error: "Cannot connect to Local Ollama at http://localhost:11434. Please make sure Ollama is running (`ollama serve`).",
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
      const errDetail =
        errData.error?.message ||
        errData.message ||
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
