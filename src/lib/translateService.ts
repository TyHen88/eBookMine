export interface TranslateResult {
  translatedText: string;
  provider: "google-translate";
}

/**
 * Translate text strictly using Google Translate API (client=gtx with fallback).
 */
export async function translateText(
  text: string,
  targetLang: string = "en"
): Promise<TranslateResult> {
  if (!text || !text.trim()) {
    return { translatedText: "", provider: "google-translate" };
  }

  const cleanText = text.trim();
  const lang = targetLang || "en";

  // Method 1: Google Translate GTX Endpoint (No 403 Forbidden blocks, Fast & Free)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      lang
    )}&dt=t&q=${encodeURIComponent(cleanText)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translatedText = data[0]
          .map((item: any) => (Array.isArray(item) ? item[0] : ""))
          .filter(Boolean)
          .join("");

        if (translatedText.trim()) {
          return {
            translatedText: translatedText.trim(),
            provider: "google-translate",
          };
        }
      }
    }
  } catch (err) {
    console.warn("[TranslateService] GTX endpoint notice:", err);
  }

  // Method 2: google-translate-open-api fallback
  try {
    const translateApi = (await import("google-translate-open-api")).default;
    const res = await translateApi(cleanText, {
      tld: "com",
      to: lang,
    });

    if (res && res.data) {
      let outputText = "";
      if (typeof res.data === "string") {
        outputText = res.data;
      } else if (Array.isArray(res.data)) {
        outputText = res.data
          .flat(Infinity)
          .filter((item: any) => typeof item === "string")
          .join("");
      }

      if (outputText.trim()) {
        return {
          translatedText: outputText.trim(),
          provider: "google-translate",
        };
      }
    }
  } catch (err: any) {
    console.error("[TranslateService] Google Translate open-api error:", err);
  }

  throw new Error("Google Translate service unavailable. Please try again.");
}
