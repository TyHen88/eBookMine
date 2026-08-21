// Copies the pdf.js worker, cmaps, and standard fonts from the installed
// pdfjs-dist package into /public so they can be served as static assets.
// Run automatically on postinstall / predev / prebuild.
import { copyFile, cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workerSrc = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const cmapsSrc = join(root, "node_modules", "pdfjs-dist", "cmaps");
const fontsSrc = join(root, "node_modules", "pdfjs-dist", "standard_fonts");

const destDir = join(root, "public");
const workerDest = join(destDir, "pdf.worker.min.mjs");
const cmapsDest = join(destDir, "cmaps");
const fontsDest = join(destDir, "standard_fonts");

try {
  await mkdir(destDir, { recursive: true });

  if (existsSync(workerSrc)) {
    await copyFile(workerSrc, workerDest);
    console.log("[copy-pdf-worker] copied worker to public/pdf.worker.min.mjs");
  }

  if (existsSync(cmapsSrc)) {
    await cp(cmapsSrc, cmapsDest, { recursive: true });
    console.log("[copy-pdf-worker] copied cmaps to public/cmaps");
  }

  if (existsSync(fontsSrc)) {
    await cp(fontsSrc, fontsDest, { recursive: true });
    console.log("[copy-pdf-worker] copied standard_fonts to public/standard_fonts");
  }
} catch (err) {
  console.warn("[copy-pdf-worker] failed:", err.message);
}
