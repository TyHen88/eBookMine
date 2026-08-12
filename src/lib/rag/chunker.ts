export interface RawPageText {
  page: number;
  chapter?: string;
  text: string;
}

export interface ChunkItem {
  page: number;
  chapter?: string;
  content: string;
  metadata?: string;
}

const CHUNK_TARGET_SIZE = 400; // ~400 characters per chunk

/**
 * Split page text into structured paragraph/sentence chunks with page & chapter metadata.
 */
export function chunkPageText(pages: RawPageText[]): ChunkItem[] {
  const chunks: ChunkItem[] = [];

  for (const p of pages) {
    const rawText = p.text.trim();
    if (!rawText) continue;

    // Split by double line breaks or paragraph breaks
    const paragraphs = rawText.split(/\n\s*\n/).filter((para) => para.trim().length > 0);

    let currentChunk = "";

    for (const para of paragraphs) {
      const cleanPara = para.replace(/\s+/g, " ").trim();

      if (currentChunk.length + cleanPara.length > CHUNK_TARGET_SIZE && currentChunk.length > 0) {
        chunks.push({
          page: p.page,
          chapter: p.chapter || undefined,
          content: currentChunk.trim(),
          metadata: JSON.stringify({ page: p.page, chapter: p.chapter }),
        });
        currentChunk = cleanPara;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n${cleanPara}` : cleanPara;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        page: p.page,
        chapter: p.chapter || undefined,
        content: currentChunk.trim(),
        metadata: JSON.stringify({ page: p.page, chapter: p.chapter }),
      });
    }
  }

  return chunks;
}
