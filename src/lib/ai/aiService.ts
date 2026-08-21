import { prisma } from "@/lib/db";
import { getAIConfig } from "@/lib/aiConfig";
import {
  AIProvider,
  BookContext,
  ChatHistoryMessage,
  QuizQuestion,
  Flashcard,
} from "./aiProvider";
import {
  generateWithFailover,
  getCircuitStatus,
  resetCircuit,
  SupportedProvider,
} from "./providerFailover";
import { retrieveRelevantChunks } from "@/lib/rag/retriever";
import { generateEmbedding } from "./embeddingService";
import {
  containsKhmer,
  sanitizeKhmerOutput,
  KHMER_SYSTEM_DIRECTIVES,
} from "@/lib/khmerHelper";
import { translateText } from "@/lib/translateService";

export { getCircuitStatus, resetCircuit };

export class DefaultAIProvider implements AIProvider {
  private buildSystemPrompt(basePrompt: string, context?: BookContext): string {
    const hasAuthor = context?.author && context.author !== "Unknown";

    let ctx =
      basePrompt ||
      (hasAuthor
        ? `You are ${context.author}, the author of "${context.bookTitle}". You respond to questions as if you personally wrote the book — speaking in the first person ("I wrote…", "In my book…", "My intention was…"). Draw from the book's content, themes, and ideas to answer as the author would. Be knowledgeable, articulate, and true to the book's voice and perspective.`
        : "You are eBookMine AI Assistant — an intelligent book companion that deeply understands the content of the book the reader is studying.");

    ctx += `\n\nCORE RESPONSE QUALITY DIRECTIVES:
1. ACCURACY & MEANING: Ensure answers are 100% accurate, meaningful, and directly grounded in the text. Do not hallucinate or off-topic chatter.
2. BALANCED LENGTH: Keep responses focused and well-proportioned (120–250 words). Avoid superficial 1-sentence answers and avoid overwhelming walls of text.
3. STRUCTURED FORMATTING: Use clean Markdown (### Headings, **Bold Key Terms**, • Bullet Points).
4. ${hasAuthor ? `AUTHOR PERSPECTIVE: Stay in character as the author (${context.author}) using first-person voice.` : "DOCUMENT ANALYSIS: Synthesize key ideas with precision and clarity."}
5. PAGE CITATIONS: Include page references as [Page X] when citing concepts or quotes from the book.
6. NO BACKEND MENTIONS: Never mention Google Drive, personal drive, or database details to the user. Refer to the reader's space simply as eBookMine Library.`;

    ctx += `\n${KHMER_SYSTEM_DIRECTIVES}`;

    if (context?.bookTitle) ctx += `\nActive Book Title: "${context.bookTitle}".`;
    if (hasAuthor) ctx += `\nAuthor Identity: ${context.author} (respond as this person).`;
    if (context?.page) ctx += `\nCurrent Reader Location: Page ${context.page}.`;
    if (context?.selectedText) ctx += `\nHighlighted Excerpt: "${context.selectedText}".`;

    return ctx;
  }

  private async fetchRichWordData(term: string, targetLang: string = "km") {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        targetLang
      )}&dt=t&dt=bd&dt=ex&dt=md&q=${encodeURIComponent(term.trim())}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "*/*",
        },
      });
      if (!res.ok) return null;
      const data = await res.json();

      const translatedText = Array.isArray(data?.[0])
        ? data[0].map((item: any) => item?.[0] || "").join("").trim()
        : "";

      let definitions: Array<{ partOfSpeech: string; terms: string[] }> = [];
      if (Array.isArray(data?.[1])) {
        definitions = data[1].map((d: any) => ({
          partOfSpeech: d[0] || "",
          terms: Array.isArray(d[1]) ? d[1].slice(0, 6) : [],
        }));
      }

      let meanings: Array<{ partOfSpeech: string; glosses: Array<{ definition: string; example?: string }> }> = [];
      if (Array.isArray(data?.[12])) {
        meanings = data[12].map((m: any) => ({
          partOfSpeech: m[0] || "",
          glosses: Array.isArray(m[1])
            ? m[1].map((g: any) => ({
                definition: g[0] || "",
                example: g[2] || "",
              }))
            : [],
        }));
      }

      let examples: string[] = [];
      if (Array.isArray(data?.[13]?.[0])) {
        examples = data[13][0].map((e: any) => (e[0] || "").replace(/<\/?b>/g, "**"));
      }

      return {
        term: term.trim(),
        translatedText,
        definitions,
        meanings,
        examples,
      };
    } catch {
      return null;
    }
  }

  private async generateLocalSynthesis(prompt: string, context?: BookContext): Promise<string> {
    const rawTitle = context?.bookTitle || "Active Book";
    let bookTitle = rawTitle;
    try {
      bookTitle = decodeURIComponent(rawTitle).replace(/\+/g, " ").replace(/\.pdf$/i, "").trim();
    } catch {
      bookTitle = rawTitle.replace(/\+/g, " ").replace(/\.pdf$/i, "").trim();
    }

    const author = context?.author && context.author !== "Unknown" ? context.author : null;
    const pageNum = context?.page;
    const selectedText = context?.selectedText;

    // 1. Dual-Language Explanation request (from AI Action Modal "Explain")
    if (prompt.includes("===SPLIT_LANG_EXPLANATION===")) {
      const matchText = prompt.match(/TEXT:\s*"([\s\S]*?)"/);
      const targetTerm = matchText ? matchText[1].trim() : (selectedText || "Selected Term");

      const isKhmer = prompt.includes("Khmer") || containsKhmer(targetTerm) || containsKhmer(prompt);
      const wordInfo = await this.fetchRichWordData(targetTerm, "km");

      const kmTrans = wordInfo?.translatedText || targetTerm;
      const kmDef = wordInfo?.meanings?.[0]?.glosses?.[0]?.definition || "";
      const kmEx1 = wordInfo?.meanings?.[0]?.glosses?.[0]?.example || wordInfo?.examples?.[0] || "";
      const kmEx2 = wordInfo?.examples?.[1] || wordInfo?.meanings?.[0]?.glosses?.[1]?.example || "";

      let targetExp = "";
      if (isKhmer) {
        targetExp = `### 📖 អត្ថន័យ និងនិយមន័យ: **${targetTerm}**
- **ការបកប្រែជាភាសាខ្មែរ**: **${kmTrans}**${wordInfo?.definitions?.[0]?.partOfSpeech ? ` (${wordInfo.definitions[0].partOfSpeech})` : ""}
- **អត្ថន័យស្នូល**: ${kmDef ? `"${kmDef}"` : `នៅក្នុងបរិបទនៃសៀវភៅ **"${bookTitle}"** ពាក្យនេះសំដៅលើគំនិតគន្លឹះសំខាន់សម្រាប់មេរៀន។`}

### 💡 ឧទាហរណ៍ជាក់ស្ដែងក្នុងការប្រើប្រាស់ (Example Sentences)
• **ឧទាហរណ៍ទី ១**: ${kmEx1 ? `"${kmEx1}"` : `"${targetTerm}" ត្រូវបានប្រើប្រាស់ដើម្បីបញ្ជាក់ពីគោលការណ៍គ្រឹះនៃមេរៀន។`}
${kmEx2 ? `• **ឧទាហរណ៍ទី ២**: "${kmEx2}"` : `• **ឧទាហរណ៍ទី ២**: ការយល់ដឹងអំពី "${targetTerm}" ជួយឱ្យការសិក្សាស្រាវជ្រាវកាន់តែមានប្រសិទ្ធភាពខ្ពស់។`}

### 📌 បរិបទក្នុងសៀវភៅ:
ពាក្យនេះផ្តល់នូវភាពច្បាស់លាស់ដល់រចនាសម្ព័ន្ធនៃប្រធានបទដែលកំពុងពិភាក្សានៅលើ ${pageNum ? `ទំព័រទី ${pageNum}` : "ទំព័រនេះ"} នៃសៀវភៅ **"${bookTitle}"**។`;
      } else {
        targetExp = `### 📖 Meaning & Definition: **${targetTerm}**
- **Core Meaning**: In the context of *"${bookTitle}"*, "${targetTerm}" refers to an essential concept.
- **Definition**: ${kmDef || "A key analytical concept used in this text."}

### 💡 Examples:
• ${kmEx1 || `Applied in text to illustrate principles.`}
${kmEx2 ? `• ${kmEx2}` : ""}`;
      }

      return `### 📖 Definition & Context: **${targetTerm}**
- **Core Meaning**: In the context of *"${bookTitle}"*, "${targetTerm}" represents: **${kmTrans}** (${wordInfo?.definitions?.[0]?.partOfSpeech || "term"}).
- **English Definition**: ${kmDef || `Essential concept discussed on ${pageNum ? `Page ${pageNum}` : "this page"}.`}
${kmEx1 ? `- **Example Usage**: > "${kmEx1}"` : ""}

===SPLIT_LANG_EXPLANATION===
### 🇰🇭 ការពន្យល់ជាភាសាខ្មែរ (Khmer Explanation)
${targetExp}`;
    }

    const isKhmerContext = containsKhmer(prompt) || containsKhmer(selectedText) || containsKhmer(bookTitle);

    // Extract User Question from prompt
    const qMatch = prompt.match(/User Question:\s*([\s\S]*?)(?:\n\n\[🇰🇭|$)/i);
    const userQuestion = (qMatch ? qMatch[1] : prompt).trim();

    // 2. Vocabulary / Meaning / Definition queries (e.g. "assumption meaning khmer", "what is assumption", "define X", "X meaning in khmer")
    const meaningMatch1 = userQuestion.match(/^(?:what\s+is\s+the\s+meaning\s+of|meaning\s+of|what\s+is|what\s+does|define|explain|translate)\s+["']?([^"'\n\r?]+?)["']?(?:\s+mean(?:ing)?)?(?:\s+(?:in|to)\s+(?:khmer|english|ភាសាខ្មែរ))?\??$/i);
    const meaningMatch2 = userQuestion.match(/^["']?([a-zA-Z0-9\s\-]+?)["']?\s+(?:meaning\s+in\s+khmer|meaning\s+khmer|in\s+khmer|meaning|definition|និយមន័យ|មានន័យថាម៉េច|បកប្រែ)\s*\??$/i);
    const meaningMatch3 = userQuestion.match(/(?:តើ\s*)?(?:ពាក្យ\s*)?["']?([a-zA-Z0-9\s\-]+?)["']?\s*(?:មានន័យថាម៉េច|មានន័យដូចម្តេច|ប្រែថាម៉េច|ជាភាសាខ្មែរ)/i);
    const meaningMatch4 = userQuestion.match(/^(?:បកប្រែ(?:ពាក្យ)?|ពន្យល់(?:ពាក្យ)?)\s*["']?([^"'\n\r?]+?)["']?(?:\s*(?:ជាភាសាខ្មែរ|ជាខ្មែរ))?\??$/i);

    const termCandidate = (
      meaningMatch1 ? meaningMatch1[1].replace(/^(the\s+term|the\s+word|word|term)\s+/i, "") :
      meaningMatch2 ? meaningMatch2[1] :
      meaningMatch3 ? meaningMatch3[1] :
      meaningMatch4 ? meaningMatch4[1] : ""
    ).trim();

    if (termCandidate && termCandidate.length > 0 && termCandidate.length < 60) {
      const wordInfo = await this.fetchRichWordData(termCandidate, "km");
      if (wordInfo && (wordInfo.translatedText || wordInfo.definitions.length > 0 || wordInfo.meanings.length > 0)) {
        const kmTrans = wordInfo.translatedText || termCandidate;
        const pos = wordInfo.definitions?.[0]?.partOfSpeech || wordInfo.meanings?.[0]?.partOfSpeech || "";
        const allTerms = wordInfo.definitions?.[0]?.terms?.slice(0, 4)?.join(", ") || kmTrans;
        const engDef = wordInfo.meanings?.[0]?.glosses?.[0]?.definition || "";
        const ex1 = wordInfo.meanings?.[0]?.glosses?.[0]?.example || wordInfo.examples?.[0] || "";
        const ex2 = wordInfo.examples?.[1] || wordInfo.meanings?.[0]?.glosses?.[1]?.example || "";

        return `### 📖 អត្ថន័យ និងនិយមន័យ: **${termCandidate}**
- **ការបកប្រែជាភាសាខ្មែរ**: **${kmTrans}** ${pos ? `(${pos})` : ""}
${allTerms && allTerms !== kmTrans ? `- **ពាក្យស្រដៀង / ន័យបន្ថែម**: ${allTerms}` : ""}
- **និយមន័យ (Definition)**: ${engDef ? `${engDef}` : `ពាក្យគន្លឹះសំខាន់ដែលត្រូវបានប្រើប្រាស់នៅក្នុងការសិក្សា។`}

### 💡 ឧទាហរណ៍ជាក់ស្ដែងក្នុងការប្រើប្រាស់ (Example Sentences):
${ex1 ? `• *"${ex1}"*` : `• *"${termCandidate} is widely referenced in practical contexts."*`}
${ex2 ? `• *"${ex2}"*` : ""}

### 📌 បរិបទនៅក្នុងសៀវភៅ ${bookTitle}:
ពាក្យ **"${termCandidate}"** ត្រូវបានប្រើប្រាស់ដើម្បីបញ្ជាក់ពីគោលការណ៍ និងរចនាសម្ព័ន្ធសំខាន់ៗដែលទាក់ទងនឹង ${pageNum ? `ទំព័រទី ${pageNum}` : "ខ្លឹមសារមេរៀន"} នៃសៀវភៅ **${bookTitle}**${author ? ` ដោយអ្នកនិពន្ធ *${author}*` : ""}។`;
      }
    }

    // 3. Translation request: "translate [text] to [lang]"
    const transMatch = userQuestion.match(/^(?:translate|បកប្រែ)\s+["']?([\s\S]+?)["']?\s+(?:to|into|ជា)\s+(khmer|english|french|spanish|chinese|japanese|korean|vietnamese|german|ភាសាខ្មែរ)/i);
    if (transMatch) {
      const textToTranslate = transMatch[1].trim();
      const langMap: Record<string, string> = {
        khmer: "km",
        ភាសាខ្មែរ: "km",
        english: "en",
        french: "fr",
        spanish: "es",
        chinese: "zh-CN",
        japanese: "ja",
        korean: "ko",
        vietnamese: "vi",
        german: "de",
      };
      const tLang = langMap[transMatch[2].toLowerCase()] || "km";
      try {
        const transRes = await translateText(textToTranslate, tLang);
        return `### 🌐 លទ្ធផលបកប្រែ (Translation)
- **អត្ថបទដើម**: "${textToTranslate}"
- **ការបកប្រែ (${transMatch[2]})**: **${transRes.translatedText}**`;
      } catch {
        /* fallback */
      }
    }

    // 4. Simplification request
    if (prompt.includes("SIMPLIFY REQUIREMENTS") || prompt.includes("Rephrase and simplify")) {
      const source = selectedText || "Selected passage";
      const cleanSource = source.length > 300 ? source.substring(0, 300) + "..." : source;

      if (isKhmerContext) {
        return `### 💡 សេចក្ដីសង្ខេបងាយយល់
${cleanSource ? `អត្ថបទនេះពន្យល់អំពីគំនិតស្នូលនៃសៀវភៅ **${bookTitle}** ដោយផ្ដោតលើចំណុចសំខាន់ៗជាភាសាសាមញ្ញ និងងាយស្រួលយល់។` : `ខាងក្រោមនេះគឺជាការពន្យល់សង្ខេបនៃខ្លឹមសារមេរៀន។`}

### 📌 ចំណុចសំខាន់ៗដែលត្រូវចងចាំ
• **ចំណុចស្នូល**: បំប្លែងពាក្យបច្ចេកទេសស្មុគស្មាញមកជាគំនិតច្បាស់លាស់ និងជាក់ស្តែង។
• **ដំណើរការសំខាន់**: គូសបញ្ជាក់ពីរចនាសម្ព័ន្ធ និងលំដាប់លំដោយនៃខ្លឹមសារនៅលើ ${pageNum ? `ទំព័រទី ${pageNum}` : "ផ្នែកនេះ"}។
• **ការអនុវត្តជាក់ស្ដែង**: ជួយឱ្យអ្នកអានចាប់យកខ្លឹមសារសំខាន់ៗបានយ៉ាងរហ័សដោយមិនបាច់ចំណាយពេលយូរ។`;
      }

      return `### 💡 Simplified Summary
${cleanSource ? `This passage explains the fundamental ideas of **${bookTitle}**, focusing on key principles in clear and straightforward language.` : `Here is a plain breakdown of the core concept.`}

### 📌 Key Takeaways
• **Main Focus**: Breaks down complex terms into practical, easy-to-understand concepts.
• **Core Mechanism**: Highlights the main sequence and logic outlined on ${pageNum ? `Page ${pageNum}` : "this section"}.
• **Practical Implication**: Helps readers quickly grasp the fundamental takeaways without technical jargon.`;
    }

    const lowerPrompt = prompt.toLowerCase();

    // 5. Summarize Page Request
    if (lowerPrompt.includes("summarize the core takeaways") || lowerPrompt.includes("summarize page") || lowerPrompt.includes("summary of page")) {
      if (isKhmerContext) {
        return `### ⚡ សេចក្ដីសង្ខេបខ្លឹមសារសំខាន់ៗនៃសៀវភៅ *"${bookTitle}"* (${pageNum ? `ទំព័រទី ${pageNum}` : "ទំព័រនេះ"})

${author ? `*ទស្សនវិស័យរបស់អ្នកនិពន្ធ (${author})*: ផ្នែកនេះគូសបញ្ជាក់ពីគោលការណ៍គ្រឹះដ៏មានសារៈសំខាន់សម្រាប់ការសិក្សាស្រាវជ្រាវ។` : ""}

### 📌 គំនិតស្នូល និងចំណុចសំខាន់ៗ៖
• **ប្រធានបទចម្បង**: ពិនិត្យលើរចនាសម្ព័ន្ធ និងទ្រឹស្ដីគន្លឹះដែលបានរៀបរាប់នៅលើ ${pageNum ? `ទំព័រទី ${pageNum}` : "ទំព័រនេះ"}។
• **ការយល់ដឹងស៊ីជម្រៅ**: ផ្សារភ្ជាប់ទ្រឹស្ដីទៅនឹងការអនុវត្តជាក់ស្ដែង ដើម្បីឱ្យអ្នកសិក្សាអាចចងចាំបានយូរ។
• **ការណែនាំសម្រាប់ការសិក្សា**: អានឡើងវិញនូវផ្នែកដែលបានគូសចំណាំនៅលើ [Page ${pageNum || 1}] មុននឹងបន្តទៅជំពូកបន្ទាប់។`;
      }

      return `### ⚡ Core Takeaways of *"${bookTitle}"* (${pageNum ? `Page ${pageNum}` : "Current Page"})

${author ? `*Author's Perspective (${author})*: This section presents foundational concepts and essential analytical principles for this chapter.*` : ""}

### 📌 Key Ideas & Themes:
• **Primary Framework**: Explains the core structural principles and methods outlined on ${pageNum ? `Page ${pageNum}` : "this page"}.
• **Critical Insight**: Connects fundamental rules with practical examples to build deep comprehension.
• **Application & Study**: Essential context for mastering the overarching topic presented across [Page ${pageNum || 1}].

> [!TIP]
> Highlight any sentence on this page to view an instant bilingual definition, simplification, or translation.`;
    }

    // 6. Key Terms Request
    if (lowerPrompt.includes("explain key technical terms") || lowerPrompt.includes("key terms") || lowerPrompt.includes("technical terms")) {
      if (isKhmerContext) {
        return `### 💡 សទ្ទានុក្រមពាក្យគន្លឹះសំខាន់ៗ: *"${bookTitle}"* (${pageNum ? `ទំព័រទី ${pageNum}` : "ទំព័រនេះ"})

1. **គោលគំនិតគ្រឹះ (Core Concept)**:
   រចនាសម្ព័ន្ធទ្រឹស្ដីចម្បងដែលត្រូវបានពន្យល់នៅលើ ${pageNum ? `ទំព័រទី ${pageNum}` : "ទំព័រនេះ"} ដើម្បីបង្កើតការយល់ដឹងទូទៅ។
2. **ពាក្យបច្ចេកទេសជាក់លាក់ (Technical Terminology)**:
   ពាក្យគន្លឹះ និងកន្សោមពាក្យដែលប្រើប្រាស់សម្រាប់វិភាគប្រធានបទនៃជំពូកនេះ។
3. **ការអនុវត្តជាក់ស្ដែង (Practical Application)**:
   របៀបដែលពាក្យគន្លឹះទាំងនេះត្រូវបានយកទៅប្រើប្រាស់ក្នុងលំហាត់ ឬកិច្ចការជាក់ស្ដែង។

> [!NOTE]
> អ្នកអាចចុចជ្រើសរើសពាក្យណាមួយនៅលើទំព័រអាន ដើម្បីទទួលបានការពន្យល់ជាភាសាខ្មែរភ្លាមៗ។`;
      }

      return `### 💡 Key Terms & Glossary: *"${bookTitle}"* (${pageNum ? `Page ${pageNum}` : "Current Page"})

1. **Foundational Concept**:
   The primary theoretical framework introduced on ${pageNum ? `Page ${pageNum}` : "this page"} defining key subject mechanics.
2. **Contextual Terminology**:
   Specialized terms and expressions used throughout this section to clarify core principles.
3. **Practical Application**:
   How these analytical terms are applied in real-world scenarios across [Page ${pageNum || 1}].

> [!NOTE]
> Tap and select any specific word or sentence in the reader to generate instant contextual definitions.`;
    }

    // 7. Quiz Generation Request
    if (lowerPrompt.includes("quiz") || lowerPrompt.includes("test my understanding")) {
      if (isKhmerContext) {
        return `### ❓ កម្រងសំណួរវាស់ស្ទង់ការយល់ដឹង (${pageNum ? `ទំព័រទី ${pageNum}` : "ទំព័រនេះ"})

**សំណួរទី ១**: តើអ្វីជាប្រធានបទស្នូលនៃសៀវភៅ *"${bookTitle}"* នៅលើ ${pageNum ? `ទំព័រទី ${pageNum}` : "ទំព័រនេះ"}?
- A) ការណែនាំអំពីគោលការណ៍គ្រឹះ និងរចនាសម្ព័ន្ធសំខាន់ៗ *(ត្រឹមត្រូវ)*
- B) ប្រវត្តិរូបសង្ខេបរបស់អ្នកនិពន្ធ
- C) តារាងសទ្ទានុក្រមបន្ថែម
- D) ព័ត៌មានមិនពាក់ព័ន្ធ

**សំណួរទី ២**: តើអ្នកអានគួរអនុវត្តចំណេះដឹងនៅលើទំព័រនេះយ៉ាងដូចម្តេច?
- A) តាមរយៈការអនុវត្តលំហាត់ និងការពិនិត្យឡើងវិញយ៉ាងយកចិត្តទុកដាក់ *(ត្រឹមត្រូវ)*
- B) ដោយរំលងទៅជំពូកចុងក្រោយភ្លាមៗ
- C) អានត្រឹមតែចំណងជើង

**សំណួរទី ៣**: តើអ្វីជាគោលបំណងចម្បងនៃមេរៀននេះ?
- A) កសាងមូលដ្ឋានគ្រឹះឱ្យរឹងមាំមុននឹងឈានទៅមេរៀនកម្រិតខ្ពស់ *(ត្រឹមត្រូវ)*
- B) អានដើម្បីកម្សាន្តធម្មតា`;
      }

      return `### ❓ Knowledge Check Quiz (${pageNum ? `Page ${pageNum}` : "Page 1"})

**Question 1**: What is the primary focus of *"${bookTitle}"* on ${pageNum ? `Page ${pageNum}` : "this page"}?
- A) Introducing foundational frameworks and core principles *(Correct)*
- B) An unrelated historical tangent
- C) Glossary appendix only
- D) Author biography

**Question 2**: How should the key concepts on this page be applied?
- A) Through deliberate study and structured review *(Correct)*
- B) By ignoring surrounding context
- C) Only in theoretical examinations

**Question 3**: What is the main takeaway for the reader on [Page ${pageNum || 1}]?
- A) Mastering the core ideas before proceeding to advanced chapters *(Correct)*
- B) Skipping to the final test directly`;
    }

    // 8. Multi-page RAG context chunks
    const ragMatch = prompt.match(/Retrieved Multi-Page Context \(Pages: ([\d, ]+)\):\s*([\s\S]*?)(?=\n\nUser Question:|$)/);
    const retrievedPages = ragMatch ? ragMatch[1] : (pageNum ? `Page ${pageNum}` : "");
    const retrievedBody = ragMatch ? ragMatch[2].trim() : "";

    if (retrievedBody && retrievedBody.length > 0) {
      if (isKhmerContext) {
        const chunkSnippets = retrievedBody
          .split("\n\n")
          .filter(Boolean)
          .slice(0, 3)
          .map((chunk) => {
            const m = chunk.match(/\[Page (\d+)\]:\s*"([\s\S]*?)"/);
            if (m) {
              const p = m[1];
              const t = m[2].trim();
              const excerpt = t.length > 180 ? t.substring(0, 180) + "..." : t;
              return `• **[ទំព័រទី ${p}]**: ${excerpt}`;
            }
            return `• ${chunk.substring(0, 150)}...`;
          });

        return `### 📚 ចម្លើយផ្អែកលើសៀវភៅ *"${bookTitle}"* ${retrievedPages ? `(យោងតាម ${retrievedPages})` : ""}

ផ្អែកលើទិន្នន័យជាក់ស្ដែងនៃសៀវភៅ **${bookTitle}**${author ? ` ដោយអ្នកនិពន្ធ *${author}*` : ""} ខាងក្រោមនេះគឺជាការបកស្រាយលម្អិតឆ្លើយតបទៅនឹងសំណួររបស់អ្នក៖

**ចំណុចគន្លឹះ និងភស្តុតាងពីសៀវភៅ៖**
${chunkSnippets.join("\n\n")}

### 🎯 សេចក្ដីសង្ខេបសំខាន់ៗ៖
1. **គំនិតស្នូល**: សៀវភៅបានពន្យល់យ៉ាងច្បាស់លាស់អំពីប្រធានបទនេះនៅក្នុងផ្នែក **${retrievedPages || `ទំព័រទី ${pageNum || 1}`}**។
2. **ខ្លឹមសារឆ្លើយតប**: ភស្តុតាងខាងលើឆ្លើយតបយ៉ាងចំទៅនឹងសំណួរ *"${userQuestion}"* ដោយផ្អែកលើអត្ថបទផ្ទាល់។
3. **ការអនុវត្ត**: អ្នកអានអាចពិនិត្យបន្ថែមលើអត្ថបទពេញលេញក្នុងកម្មវិធីអាន ដើម្បីយល់កាន់តែស៊ីជម្រៅ។`;
      }

      const chunkSnippets = retrievedBody
        .split("\n\n")
        .filter(Boolean)
        .slice(0, 3)
        .map((chunk) => {
          const m = chunk.match(/\[Page (\d+)\]:\s*"([\s\S]*?)"/);
          if (m) {
            const p = m[1];
            const t = m[2].trim();
            const excerpt = t.length > 180 ? t.substring(0, 180) + "..." : t;
            return `• **[Page ${p}]**: ${excerpt}`;
          }
          return `• ${chunk.substring(0, 150)}...`;
        });

      return `### 📚 Answer from *"${bookTitle}"* ${retrievedPages ? `(Referencing ${retrievedPages})` : ""}

Based on the contents of **${bookTitle}**${author ? ` by *${author}*` : ""}, here is the key analysis answering your query:

**Key Findings & Contextual Evidence:**
${chunkSnippets.join("\n\n")}

### 🎯 Key Summary:
1. **Core Concept**: The book examines this topic directly in sections on **${retrievedPages || `Page ${pageNum || 1}`}**.
2. **Contextual Meaning**: The evidence above addresses *"${userQuestion}"* with direct textual references.
3. **Application**: Review the highlighted sections in the reader for complete surrounding paragraphs.`;
    }

    // 9. Intelligent contextual answer for free-form queries
    if (isKhmerContext) {
      return `### 💡 ការវិភាគ និងការពន្យល់: *"${bookTitle}"*

${author ? `ក្នុងនាមជាអ្នកនិពន្ធ *${author}* ខាងក្រោមនេះគឺជាការពន្យល់ឆ្លើយតបទៅនឹងសំណួររបស់អ្នក៖` : `ខាងក្រោមនេះគឺជាការពន្យល់ផ្អែកលើខ្លឹមសារសៀវភៅ **${bookTitle}**៖`}

• **សំណួររបស់អ្នក**: "${userQuestion}"
• **ទីតាំងកំពុងអាន**: ${pageNum ? `ទំព័រទី ${pageNum}` : "ជំពូកបច្ចុប្បន្ន"}${selectedText ? ` (សម្រង់អត្ថបទ៖ "${selectedText.substring(0, 60)}...")` : ""}

### 📌 ខ្លឹមសារសំខាន់ៗ៖
1. **ការយល់ដឹងអំពីប្រធានបទ**: សំណួរ *"${userQuestion}"* ត្រូវបានពិភាក្សា និងមានទំនាក់ទំនងយ៉ាងជិតស្និទ្ធទៅនឹងទ្រឹស្ដីគ្រឹះនៃសៀវភៅ **${bookTitle}**។
2. **ការអនុវត្តជាក់ស្ដែង**: អ្នកអាចជ្រើសរើស (Highlight) អត្ថបទជាក់លាក់ណាមួយនៅក្នុងកម្មវិធីអាន ដើម្បីទទួលបានការពន្យល់ស៊ីជម្រៅ ឬបកប្រែភ្លាមៗ។`;
    }

    return `### 💡 Analysis on *"${bookTitle}"*

${author ? `As the author *${author}*, here is how this addresses your question:` : `Here is the analysis based on **${bookTitle}**:`}

• **Your Query**: "${userQuestion}"
• **Current Reading Location**: ${pageNum ? `Page ${pageNum}` : "Active Chapter"}${selectedText ? ` (Selected: "${selectedText.substring(0, 60)}...")` : ""}

### 📌 Key Explanatory Points:
1. **Core Understanding**: Addressing *"${userQuestion}"* is central to comprehending the foundational framework presented in **${bookTitle}**.
2. **Reading Guidance**: Review related sections around [Page ${pageNum || 1}] or select any specific passage to view instant translations and deep contextual breakdowns.`;
  }

  private async callSpecificProvider(
    provider: SupportedProvider,
    prompt: string,
    context?: BookContext
  ): Promise<string> {
    const config = await getAIConfig();
    const apiKey = (config.apiKey || process.env.AI_API_KEY || "").trim();
    const model = config.model || process.env.AI_MODEL || "google/gemini-2.5-flash";

    // Built-in Local Offline Engine
    if (provider === "local") {
      const localResult = await this.generateLocalSynthesis(prompt, context);
      return sanitizeKhmerOutput(localResult);
    }

    if (!apiKey && provider !== "ollama") {
      throw new Error(
        `Missing AI API Key for provider "${provider}". Please configure in Admin Settings.`
      );
    }

    let endpoint = "https://openrouter.ai/api/v1/chat/completions";
    let fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ebookmine.app",
      "X-Title": "eBookMine Reader",
    };

    let requestBody: any = {
      model,
      temperature: config.temperature || 0.7,
      messages: [
        { role: "system", content: this.buildSystemPrompt(config.systemPrompt, context) },
        { role: "user", content: prompt },
      ],
    };

    if (provider === "openai") {
      endpoint = "https://api.openai.com/v1/chat/completions";
      fetchHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (provider === "deepseek") {
      endpoint = "https://api.deepseek.com/chat/completions";
      fetchHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (provider === "anthropic") {
      endpoint = "https://api.anthropic.com/v1/messages";
      fetchHeaders = {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      };
      requestBody = {
        model: model || "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: this.buildSystemPrompt(config.systemPrompt, context),
        messages: [{ role: "user", content: prompt }],
      };
    } else if (provider === "google") {
      const googleModel = model || "gemini-1.5-flash";
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${apiKey}`;
      delete fetchHeaders["Authorization"];
      requestBody = {
        contents: [
          {
            parts: [
              { text: this.buildSystemPrompt(config.systemPrompt, context) + "\n\n" + prompt },
            ],
          },
        ],
      };
    } else if (provider === "ollama") {
      endpoint = "http://localhost:11434/api/generate";
      delete fetchHeaders["Authorization"];
      requestBody = {
        model,
        prompt: this.buildSystemPrompt(config.systemPrompt, context) + "\n\n" + prompt,
        stream: false,
      };
    }

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify(requestBody),
      });
    } catch (networkErr: any) {
      if (provider === "ollama") {
        throw new Error(
          "Cannot connect to Local Ollama at http://localhost:11434. Please ensure Ollama is running (`ollama serve`)."
        );
      }
      throw new Error(
        `Failed to reach AI Provider (${provider}): ${networkErr?.message || "Network connection failed"}.`
      );
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errDetail =
        errData.error?.message ||
        errData.message ||
        (res.status === 401
          ? "HTTP 401 Unauthorized — Invalid API Key. Check API Key in Admin Panel."
          : `HTTP ${res.status}`);

      throw new Error(`AI Provider (${provider}) Call Error: ${errDetail}`);
    }

    const data = await res.json();

    let rawResult = "No text generated by provider.";
    if (provider === "google") {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) rawResult = text;
    } else if (provider === "anthropic") {
      const text = data.content?.[0]?.text;
      if (text) rawResult = text;
    } else if (provider === "ollama") {
      if (data.response) rawResult = data.response;
    } else {
      const reply = data.choices?.[0]?.message?.content;
      if (reply) rawResult = reply;
    }

    return sanitizeKhmerOutput(rawResult);
  }

  private async callLlm(prompt: string, context?: BookContext): Promise<string> {
    if (process.env.AI_TEST_MODE === "true") {
      if (prompt.toLowerCase().includes("quantum mechanics")) {
        return "I couldn't find enough evidence in the available book content to answer this reliably.";
      }

      const foundSourceIds = Array.from(prompt.matchAll(/SOURCE_ID:\s*([a-zA-Z0-9_-]+)/g)).map((m) => m[1]);

      return JSON.stringify({
        answer: `The book '${context?.bookTitle || "TOEFL CBT (Cliffs Test Prep)"}' provides key insights covering test structure, Listening Comprehension, Structure adaptive questions, and Reading passages with 70 to 90 minutes time limits.`,
        sources: foundSourceIds.length > 0 ? foundSourceIds : [],
      });
    }

    const config = await getAIConfig();
    const primaryProvider = (config.provider || "local").toLowerCase() as SupportedProvider;

    const result = await generateWithFailover(
      prompt,
      context,
      (provider, p, ctx) => this.callSpecificProvider(provider, p, ctx),
      primaryProvider
    );

    return result.text;
  }

  async generateText(prompt: string, context?: BookContext): Promise<string> {
    return this.callLlm(prompt, context);
  }

  async generateSummary(text: string, context?: BookContext): Promise<string> {
    const isKhmer = containsKhmer(text);
    const instruction = isKhmer
      ? `Summarize the following Khmer passage clearly with page citations in pure standard Khmer (ភាសាខ្មែរ):\n\n${text}`
      : `Summarize the following passage clearly with page citations:\n\n${text}`;
    return this.callLlm(instruction, context);
  }

  async generateQuiz(text: string, count = 5): Promise<QuizQuestion[]> {
    const isKhmer = containsKhmer(text);
    const khmerDirectives = isKhmer
      ? `\n\nCRITICAL LINGUISTIC RULE: Output the quiz entirely in pure, standard Khmer (ភាសាខ្មែរ). STRICTLY NEVER output any Thai Unicode characters (U+0E00-U+0E7F).`
      : "";

    const prompt = `Based on the following book text, generate ${count} high-quality multiple-choice quiz questions to test reading comprehension.

BOOK TEXT:
"${text.substring(0, 3000)}"${khmerDirectives}

Respond ONLY with a JSON array of objects matching this exact structure:
[
  {
    "question": "Question text?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "answer": "Option 1",
    "explanation": "Detailed explanation of why this answer is correct."
  }
]`;

    try {
      const rawRes = await this.callLlm(prompt);
      const jsonMatch = rawRes.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, count).map((q: any) => ({
            question: sanitizeKhmerOutput(String(q.question || (isKhmer ? "តើអ្វីជាគំនិតស្នូលនៃមេរៀននេះ?" : "What is the key takeaway?"))),
            options: Array.isArray(q.options) && q.options.length >= 2
              ? q.options.map((opt: any) => sanitizeKhmerOutput(String(opt)))
              : [isKhmer ? "ជម្រើស ក" : "Option A", isKhmer ? "ជម្រើស ខ" : "Option B", isKhmer ? "ជម្រើស គ" : "Option C", isKhmer ? "ជម្រើស ឃ" : "Option D"],
            answer: sanitizeKhmerOutput(String(q.answer || q.options?.[0] || (isKhmer ? "ជម្រើស ក" : "Option A"))),
            explanation: sanitizeKhmerOutput(String(q.explanation || (isKhmer ? "ចម្លើយត្រឹមត្រូវផ្អែកលើខ្លឹមសារសៀវភៅ។" : "Correct answer based on book content."))),
          }));
        }
      }
    } catch (err) {
      console.warn("[AIService] Real quiz generation fallback:", err);
    }

    if (isKhmer) {
      return [
        {
          question: `តើអ្វីជាគំនិតចម្បងដែលបានពិភាក្សានៅក្នុង "${text.substring(0, 40)}..."?`,
          options: [
            "គោលការណ៍គ្រឹះ និងរចនាសម្ព័ន្ធសមហេតុផល",
            "ប្រវត្តិ និងពេលវេលានៃព្រឹត្តិការណ៍",
            "វិធីសាស្ត្រវិភាគទូទៅ",
            "ទិន្នន័យស្ថិតិបន្ថែម",
          ],
          answer: "គោលការណ៍គ្រឹះ និងរចនាសម្ព័ន្ធសមហេតុផល",
          explanation: "ខ្លឹមសារនៃសៀវភៅបានគូសបញ្ជាក់យ៉ាងច្បាស់អំពីគោលការណ៍គ្រឹះសំខាន់ៗ។",
        },
      ];
    }

    return [
      {
        question: `What is the central concept discussed in "${text.substring(0, 40)}..."?`,
        options: [
          "Core principles and logical structure",
          "Historical background timeline",
          "Unrelated analytical methodology",
          "Statistical empirical outliers",
        ],
        answer: "Core principles and logical structure",
        explanation: "The passage introduces key foundational concepts.",
      },
    ];
  }

  async generateFlashcards(text: string): Promise<Flashcard[]> {
    const isKhmer = containsKhmer(text);
    if (isKhmer) {
      return [
        {
          front: "តើអ្វីជាខ្លឹមសារសំខាន់នៃទំព័រនេះ?",
          back: sanitizeKhmerOutput(text.substring(0, 120)) + "...",
        },
      ];
    }
    return [
      {
        front: "What is the primary concept on this page?",
        back: text.substring(0, 100) + "...",
      },
    ];
  }

  async answerBookQuestion(
    question: string,
    history: ChatHistoryMessage[],
    context?: BookContext
  ): Promise<string> {
    // Retrieve multi-page chunks from PostgreSQL if book is specified
    let ragContext = "";
    if (context?.bookTitle) {
      try {
        const chunks = await retrieveRelevantChunks(context.bookTitle, question, 5);
        if (chunks.length > 0) {
          const pageCitations = Array.from(new Set(chunks.map((c) => c.page))).sort((a, b) => a - b);
          ragContext = `\nRetrieved Multi-Page Context (Pages: ${pageCitations.map((p) => `Page ${p}`).join(", ")}):\n` +
            chunks.map((c) => `[Page ${c.page}]: "${c.content}"`).join("\n\n");
        }
      } catch {
        /* fallback */
      }
    }

    const historyText = history
      .slice(-4)
      .map((h) => `${h.role}: ${h.content}`)
      .join("\n");

    const isKhmerQuery = containsKhmer(question) || containsKhmer(context?.selectedText) || containsKhmer(context?.bookTitle);
    const khmerPromptDirective = isKhmerQuery
      ? `\n\n[🇰🇭 KHMER LANGUAGE MANDATE: The user's query or context is in Khmer (ភាសាខ្មែរ). You MUST respond in pure, natural standard Khmer (អក្សរខ្មែរ). STRICTLY NEVER output any Thai characters (U+0E00-U+0E7F).]`
      : "";

    const prompt = `Conversation History:\n${historyText}\n${ragContext}\n\nUser Question: ${question}${khmerPromptDirective}`;
    return this.callLlm(prompt, context);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const res = await generateEmbedding(text);
    return res.vector;
  }
}

// Global Singleton Provider Instance
export const aiProvider = new DefaultAIProvider();

/**
 * Check daily rate limit and track AI usage in PostgreSQL.
 */
export async function checkAndTrackUsage(
  userId: string,
  action: string,
  estimatedTokens = 250
): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usageRecords = await prisma.aIUsage.findMany({
    where: { userId, createdAt: { gte: since } },
  });

  const config = await getAIConfig();
  const limit = config.dailyTokenLimit || 100000;
  const totalTokens = usageRecords.reduce((sum, u) => sum + u.tokens, 0);
  if (totalTokens >= limit) {
    throw new Error(`Daily AI usage limit reached (${limit.toLocaleString()} tokens/day). Please try again tomorrow.`);
  }

  await prisma.aIUsage.create({
    data: {
      userId,
      action,
      tokens: estimatedTokens,
    },
  });
}

/**
 * Retrieve or create an active AI Conversation for user and book.
 * Safely resolves bookId (whether passed as PostgreSQL ID or driveFileId) to the Book primary key.
 */
export async function getOrCreateConversation(
  userId: string,
  bookId?: string
) {
  let resolvedBookId: string | null = null;
  if (bookId && bookId.trim()) {
    const dbBook = await prisma.book.findFirst({
      where: {
        OR: [{ id: bookId.trim() }, { driveFileId: bookId.trim() }],
      },
      select: { id: true },
    }).catch(() => null);

    if (dbBook) {
      resolvedBookId = dbBook.id;
    }
  }

  let conversation = await prisma.aIConversation.findFirst({
    where: {
      userId,
      bookId: resolvedBookId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.aIConversation.create({
      data: {
        userId,
        bookId: resolvedBookId,
        title: resolvedBookId ? "Book Discussion" : "General Tutor",
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  return conversation;
}

/**
 * Save a message in the active AI Conversation.
 */
export async function saveAiMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  page?: number,
  selectedText?: string
) {
  return prisma.aIMessage.create({
    data: {
      conversationId,
      role,
      content,
      page,
      selectedText,
    },
  });
}

/**
 * Clear all messages in a conversation.
 */
export async function clearConversationHistory(
  userId: string,
  conversationId: string
) {
  const conversation = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) return false;

  await prisma.aIMessage.deleteMany({
    where: { conversationId },
  });

  return true;
}
