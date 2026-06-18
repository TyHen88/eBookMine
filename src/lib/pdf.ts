"use client";

import { pdfjs } from "react-pdf";

// Serve the pdf.js worker from /public (copied there by scripts/copy-pdf-worker.mjs).
// Loading it as a static asset avoids webpack/Terser trying to minify the .mjs module.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export { pdfjs };

export interface ExtractedInfo {
  pageCount: number;
  title: string;
  author: string;
  cover: string | null;
}

/**
 * Parse a PDF File in the browser to pull out the page count, embedded
 * Title/Author metadata, and a small cover thumbnail (rendered first page).
 */
export async function extractPdfInfo(file: File): Promise<ExtractedInfo> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  let title = "";
  let author = "";
  try {
    const meta: any = await doc.getMetadata();
    title = meta?.info?.Title?.trim() ?? "";
    author = meta?.info?.Author?.trim() ?? "";
  } catch {
    /* metadata is optional */
  }

  let cover: string | null = null;
  try {
    cover = await renderCover(doc);
  } catch {
    /* cover is best-effort */
  }

  return { pageCount: doc.numPages, title, author, cover };
}

async function renderCover(doc: any): Promise<string | null> {
  const page = await doc.getPage(1);
  // Target a thumbnail roughly 320px wide.
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1.5, 320 / baseViewport.width);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.7);
}
