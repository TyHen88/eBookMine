import fs from "fs";
import path from "path";
import { Readable } from "stream";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "books");

export function ensureUploadDir(): string {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  } catch {
    /* Read-only filesystem in serverless environments like Vercel */
  }
  return UPLOAD_DIR;
}

export async function saveLocalBookFile(
  fileId: string,
  bytes: ArrayBuffer | Buffer | Uint8Array
): Promise<string> {
  const dir = ensureUploadDir();
  const filePath = path.join(dir, `${fileId}.pdf`);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes as any);
  await fs.promises.writeFile(filePath, new Uint8Array(buffer));
  return filePath;
}

export function getLocalBookFilePath(fileId: string): string | null {
  try {
    const filePath = path.join(UPLOAD_DIR, `${fileId}.pdf`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  } catch {
    /* Read-only filesystem in serverless environments like Vercel */
  }
  return null;
}

export function streamLocalFile(filePath: string, range?: string): Response {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(fileStream);

    return new Response(webStream as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunksize),
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  const fileStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(fileStream);

  return new Response(webStream as any, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Content-Type": "application/pdf",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

/**
 * Saves a stream to disk in the background without blocking the HTTP response.
 */
export async function cacheStreamToDisk(
  fileId: string,
  stream: ReadableStream<Uint8Array>
): Promise<string | null> {
  try {
    const dir = ensureUploadDir();
    const filePath = path.join(dir, `${fileId}.pdf`);
    const tempPath = path.join(dir, `${fileId}.tmp`);

    const writeStream = fs.createWriteStream(tempPath);
    const nodeStream = Readable.fromWeb(stream as any);

    await new Promise<void>((resolve, reject) => {
      nodeStream.pipe(writeStream);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    if (fs.existsSync(tempPath)) {
      await fs.promises.rename(tempPath, filePath);
      return filePath;
    }
  } catch (err) {
    console.warn(`[cacheStreamToDisk] Failed to cache ${fileId} in background:`, err);
  }
  return null;
}
