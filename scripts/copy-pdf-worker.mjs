// Copies the pdf.js worker from the installed pdfjs-dist package into /public
// so it can be served as a static asset (referenced by src/lib/pdf.ts).
// Run automatically on postinstall / predev / prebuild.
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destDir = join(root, "public");
const dest = join(destDir, "pdf.worker.min.mjs");

try {
  if (!existsSync(src)) {
    console.warn("[copy-pdf-worker] source not found, skipping:", src);
    process.exit(0);
  }
  await mkdir(destDir, { recursive: true });
  await copyFile(src, dest);
  console.log("[copy-pdf-worker] copied worker to public/pdf.worker.min.mjs");
} catch (err) {
  console.warn("[copy-pdf-worker] failed:", err.message);
}
