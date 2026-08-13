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
    const keyToUse = (apiKey || savedConfig.apiKey || process.env.AI_API_KEY || "").trim();

    if (!keyToUse && provider !== "ollama") {
      return NextResponse.json(
        {
          ok: false,
          error: "Please paste your API key in the API Key box above before testing.",
        },
        { status: 400 }
      );
    }

    const activeProvider = provider || savedConfig.provider || "openrouter";
    const targetModel = model || savedConfig.model || "google/gemini-2.5-flash";
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
    } else if (activeProvider === "google") {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyToUse}`;
      delete fetchHeaders["Authorization"];
      requestBody = {
        contents: [{ parts: [{ text: "Ping connection test" }] }],
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

    const res = await fetch(endpoint, {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify(requestBody),
    });

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
