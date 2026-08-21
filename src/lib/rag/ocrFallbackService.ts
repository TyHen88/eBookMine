import { RawPageText } from "./chunker";
import { createWorker } from "tesseract.js";
import { createCanvas } from "canvas";

export interface OcrFallbackOptions {
  minCharThreshold?: number; // Minimum character count to consider text non-empty (default: 60)
  lang?: string;             // Tesseract OCR language code (default: "eng")
}

/**
 * Node.js-compatible canvas factory for PDF.js server-side page rendering.
 */
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return {
      canvas,
      context,
    };
  }

  reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: { canvas: any; context: any }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/**
 * Fills low-density / scanned PDF pages with OCR extracted text using Tesseract.js.
 *
 * @param pdfBuffer Raw PDF file binary buffer.
 * @param pages Client-extracted raw pages list.
 * @param options Custom thresholds and language parameters.
 * @returns Updated list of RawPageText with OCR content filled for scanned pages.
 */
export async function fillLowDensityPagesWithOcr(
  pdfBuffer: Buffer | ArrayBuffer | Uint8Array,
  pages: RawPageText[],
  options: OcrFallbackOptions = {}
): Promise<RawPageText[]> {
  const threshold = options.minCharThreshold ?? 60;
  const lang = options.lang ?? "eng";

  // Identify pages that have low or empty text density
  const lowDensityIndices: number[] = [];
  pages.forEach((p, idx) => {
    const charCount = p.text ? p.text.trim().length : 0;
    if (charCount < threshold) {
      lowDensityIndices.push(idx);
    }
  });

  // If all pages have sufficient text density, skip OCR rendering
  if (lowDensityIndices.length === 0) {
    return pages;
  }

  console.log(
    `[OCRFallback] Detected ${lowDensityIndices.length} low-density/scanned pages (< ${threshold} chars). Initializing OCR worker...`
  );

  let worker: any = null;
  const updatedPages: RawPageText[] = pages.map((p) => ({ ...p }));

  try {
    // Dynamically import pdfjs-dist legacy module for Node.js runtime
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const bufferData = Buffer.isBuffer(pdfBuffer)
      ? new Uint8Array(pdfBuffer)
      : pdfBuffer instanceof Uint8Array
      ? pdfBuffer
      : new Uint8Array(pdfBuffer);

    const canvasFactory = new NodeCanvasFactory();
    const loadingTask = pdfjsLib.getDocument({
      data: bufferData,
      disableFontFace: true,
      canvasFactory: canvasFactory as any,
    });

    const pdfDoc = await loadingTask.promise;

    // Initialize Tesseract worker
    worker = await createWorker(lang);

    for (const idx of lowDensityIndices) {
      const pageObj = updatedPages[idx];
      const pageNum = pageObj.page;

      if (pageNum > pdfDoc.numPages) continue;

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // 1.5x scale for optimal OCR accuracy

        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext("2d");

        const renderContext = {
          canvasContext: context as any,
          viewport,
          canvasFactory: canvasFactory as any,
        };

        await page.render(renderContext).promise;

        const imageBuffer = canvas.toBuffer("image/png");
        const ocrResult = await worker.recognize(imageBuffer);
        const recognizedText = ocrResult.data.text ? ocrResult.data.text.trim() : "";

        if (recognizedText.length > (pageObj.text ? pageObj.text.trim().length : 0)) {
          console.log(
            `[OCRFallback] Page ${pageNum}: OCR successfully extracted ${recognizedText.length} characters (confidence: ${ocrResult.data.confidence}%).`
          );
          pageObj.text = recognizedText;
          pageObj.layoutMetadata = JSON.stringify({
            ocrApplied: true,
            ocrConfidence: ocrResult.data.confidence,
            ocrLanguage: lang,
          });
        }
      } catch (pageErr) {
        console.warn(`[OCRFallback] Warning: OCR failed for page ${pageNum}:`, pageErr);
      }
    }
  } catch (err) {
    console.error("[OCRFallback] OCR fallback execution error:", err);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        /* Ignore cleanup errors */
      }
    }
  }

  return updatedPages;
}
