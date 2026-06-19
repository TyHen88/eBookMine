// One-off generator for PWA icons. Run with: node scripts/gen-icons.mjs
// Rasterizes the eBookMine book logo into the PNG icons referenced by the
// web manifest and Apple touch icon. Sharp is already a transitive dep (Next).
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BRAND = "#1d57f5";

// The open-book mark, parameterised so it can be drawn at any size/inset.
const bookMark = (s, inset) => {
  const w = s - inset * 2;
  const k = w / 64; // original art is on a 64-unit grid
  const x = (n) => inset + n * k;
  const y = (n) => inset + n * k;
  return `
    <path d="M${x(13)} ${y(17)}c${6.2 * k} ${-3 * k} ${12.5 * k} ${-3 * k} ${18.7 * k} ${1 * k} ${6.2 * k} ${-4 * k} ${12.5 * k} ${-4 * k} ${18.7 * k} ${-1 * k}v${31 * k}c${-6.2 * k} ${-3 * k} ${-12.5 * k} ${-3 * k} ${-18.7 * k} ${1 * k} ${-6.2 * k} ${-4 * k} ${-12.5 * k} ${-4 * k} ${-18.7 * k} ${-1 * k}V${y(17)}z" fill="#fff"/>
    <path d="M${x(31.7)} ${y(18.5)}v${31 * k}" stroke="${BRAND}" stroke-width="${2.6 * k}" stroke-linecap="round"/>`;
};

// "any" purpose: rounded square, logo fills most of the tile.
const anyIcon = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${BRAND}"/>
  ${bookMark(s, s * 0.2)}
</svg>`;

// "maskable" purpose: full-bleed background, logo kept inside the ~80% safe zone.
const maskableIcon = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${BRAND}"/>
  ${bookMark(s, s * 0.28)}
</svg>`;

const out = (p) => join(process.cwd(), p);

const targets = [
  ["public/icons/icon-192.png", anyIcon(192)],
  ["public/icons/icon-512.png", anyIcon(512)],
  ["public/icons/maskable-192.png", maskableIcon(192)],
  ["public/icons/maskable-512.png", maskableIcon(512)],
  // Apple touch icon: iOS adds its own corners and dislikes transparency,
  // so reuse the full-bleed (maskable) art at 180px.
  ["public/apple-icon.png", maskableIcon(180)],
];

await mkdir(out("public/icons"), { recursive: true });
for (const [path, svg] of targets) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(out(path), png);
  console.log("wrote", path);
}
