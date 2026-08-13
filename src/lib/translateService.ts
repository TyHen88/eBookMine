export interface TranslateDefinition {
  partOfSpeech: string;
  terms: string[];
}

export interface TranslateResult {
  translatedText: string;
  detectedSourceLang?: string;
  detectedSourceLangName?: string;
  definitions?: TranslateDefinition[];
  provider: "google-translate";
}

const LANGUAGE_NAMES: Record<string, string> = {
  auto: "Detect language",
  en: "English",
  km: "Khmer",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  "zh-CN": "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  vi: "Vietnamese",
  ko: "Korean",
  ru: "Russian",
  it: "Italian",
  pt: "Portuguese",
  hi: "Hindi",
  ar: "Arabic",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  id: "Indonesian",
};


export function getLanguageName(code?: string): string {
  if (!code) return "Auto Detect";
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

/**
 * Translate text strictly using Google Translate API (client=gtx with fallback).
 */
export async function translateText(
  text: string,
  targetLang: string = "en",
  sourceLang: string = "auto"
): Promise<TranslateResult> {
  if (!text || !text.trim()) {
    return { translatedText: "", provider: "google-translate" };
  }

  const cleanText = text.trim();
  const lang = targetLang || "en";
  const sl = sourceLang || "auto";

  // Method 1: Google Translate GTX Endpoint (with dt=t & dt=bd for translations + definitions)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sl
    )}&tl=${encodeURIComponent(lang)}&dt=t&dt=bd&q=${encodeURIComponent(cleanText)}`;

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

        const detectedLangCode = typeof data[2] === "string" ? data[2] : undefined;
        const detectedName = detectedLangCode ? getLanguageName(detectedLangCode) : undefined;

        let definitions: TranslateDefinition[] | undefined;
        if (Array.isArray(data[1])) {
          definitions = data[1].map((dictGroup: any) => ({
            partOfSpeech: dictGroup[0] || "definition",
            terms: Array.isArray(dictGroup[1]) ? dictGroup[1].slice(0, 8) : [],
          }));
        }

        if (translatedText.trim()) {
          return {
            translatedText: translatedText.trim(),
            detectedSourceLang: detectedLangCode,
            detectedSourceLangName: detectedName,
            definitions,
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

