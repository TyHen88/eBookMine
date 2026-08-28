import * as fs from "fs";
try {
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (fs.existsSync(".env")) process.loadEnvFile(".env");
} catch {}

import { prisma } from "../src/lib/db";
import { containsKhmer } from "../src/lib/khmerHelper";

async function main() {
  console.log("=================================================");
  console.log("🇰🇭 eBookMine Book Language Migration (KM / EN)");
  console.log("=================================================\n");

  const books = await prisma.book.findMany({
    select: {
      id: true,
      title: true,
      fileName: true,
      language: true,
      description: true,
      authors: { select: { author: { select: { name: true } } } },
      categories: { select: { category: { select: { name: true } } } },
    },
  });

  console.log(`Found ${books.length} total books in PostgreSQL.`);

  let updatedKm = 0;
  let updatedEn = 0;
  let alreadyCorrect = 0;

  const BATCH_SIZE = 50;

  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const chunk = books.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (b) => {
        const authorStr = b.authors.map((a) => a.author.name).join(" ");
        const catStr = b.categories.map((c) => c.category.name).join(" ");
        const textToCheck = `${b.title || ""} ${b.fileName || ""} ${b.description || ""} ${authorStr} ${catStr}`;

        const isKhmer = containsKhmer(textToCheck);
        const targetLang = isKhmer ? "km" : "en";

        if (b.language !== targetLang) {
          await prisma.book.update({
            where: { id: b.id },
            data: { language: targetLang },
          });

          if (targetLang === "km") {
            updatedKm++;
            console.log(`[🇰🇭 KHMER] Set ID: ${b.id} | Title: "${b.title}"`);
          } else {
            updatedEn++;
          }
        } else {
          alreadyCorrect++;
        }
      })
    );
  }

  console.log("\n=================================================");
  console.log("📊 MIGRATION SUMMARY");
  console.log("=================================================");
  console.log(`• Total books processed: ${books.length}`);
  console.log(`• Updated to Khmer (km): ${updatedKm}`);
  console.log(`• Updated to English (en): ${updatedEn}`);
  console.log(`• Already matching: ${alreadyCorrect}`);

  const distribution = await prisma.book.groupBy({
    by: ["language"],
    _count: { _all: true },
  });
  console.log("\nNew Language Breakdown in Neon DB:", distribution);
  console.log("=================================================\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
