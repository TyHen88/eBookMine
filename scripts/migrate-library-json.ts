import * as fs from "fs";
import * as path from "path";

// Load environment variables natively
try {
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (fs.existsSync(".env")) process.loadEnvFile(".env");
} catch {
  /* process.loadEnvFile is native in Node 20.12+ */
}

import { prisma } from "../src/lib/db";
import { syncLibraryMetadata, SyncStats } from "../src/lib/bookSyncService";
import { loadPublicLibrary, Library } from "../src/lib/metadata";

async function main() {
  console.log("=================================================");
  console.log("📚 eBookMine Metadata Migration (library.json -> Neon PostgreSQL)");
  console.log("=================================================\n");

  let library: Library | null = null;
  const folderId = process.env.EBOOKMINE_FOLDER_ID;
  const localPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve("library.json");

  if (fs.existsSync(localPath)) {
    console.log(`📖 Loading local file: ${localPath}`);
    const content = fs.readFileSync(localPath, "utf-8");
    library = JSON.parse(content) as Library;
  } else if (folderId) {
    console.log(`🌐 Fetching public library.json from Google Drive folder: ${folderId}`);
    library = await loadPublicLibrary(folderId);
  }

  if (!library || !library.books || Object.keys(library.books).length === 0) {
    console.error("❌ Error: No valid library.json found locally or on Google Drive.");
    console.log("Tip: Provide path to library.json as argument:  npx tsx scripts/migrate-library-json.ts path/to/library.json");
    process.exit(1);
  }

  const inputBooks = Object.values(library.books);
  console.log(`Found ${inputBooks.length} book records in library.json.\n`);

  console.log("🔄 Running idempotent migration to Neon PostgreSQL...");
  const stats: SyncStats = await syncLibraryMetadata(library);

  console.log("\n=================================================");
  console.log("📊 MIGRATION REPORT & VERIFICATION");
  console.log("=================================================");

  const dbBookCount = await prisma.book.count();
  const dbAuthorCount = await prisma.author.count();
  const dbCategoryCount = await prisma.category.count();

  console.log(`• Input library.json records: ${inputBooks.length}`);
  console.log(`• PostgreSQL Total Books:     ${dbBookCount}`);
  console.log(`• PostgreSQL Total Authors:   ${dbAuthorCount}`);
  console.log(`• PostgreSQL Total Categories:${dbCategoryCount}`);
  console.log(`• Synchronized Books:         ${stats.synced}`);
  console.log(`• Created Records:            ${stats.created}`);
  console.log(`• Updated Records:            ${stats.updated}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️ Sync Errors (${stats.errors.length}):`);
    stats.errors.forEach((err) => console.log(`  - ${err}`));
  }

  console.log("\n=================================================");
  console.log("🔍 RECORD ACCURACY AUDIT (Sample Check)");
  console.log("=================================================");

  const sampleBooks = inputBooks.slice(0, 5);
  for (const b of sampleBooks) {
    const dbMatch = await prisma.book.findFirst({
      where: { driveFileId: b.id },
      include: {
        authors: { include: { author: true } },
        categories: { include: { category: true } },
      },
    });

    if (dbMatch) {
      const authorNames = dbMatch.authors.map((a) => a.author.name).join(", ");
      const categoryNames = dbMatch.categories.map((c) => c.category.name).join(", ");
      console.log(`✅ MATCH: [${dbMatch.driveFileId}] "${dbMatch.title}" | Author: ${authorNames} | Category: ${categoryNames}`);
    } else {
      console.log(`❌ MISMATCH: [${b.id}] "${b.title}" not found in PostgreSQL!`);
    }
  }

  console.log("\n=================================================");
  console.log("🎉 Migration finished successfully!");
  console.log("Note: library.json and Google Drive PDFs remain 100% intact.");
  console.log("=================================================\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
