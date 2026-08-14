import fs from "fs";
import path from "path";
import { Readable } from "stream";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "books");

export function ensureUploadDir(): string {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

export function getLocalBookFilePath(fileId: string): string | null {
  const dir = ensureUploadDir();
  const filePath = path.join(dir, `${fileId}.pdf`);
  if (fs.existsSync(filePath)) {
    return filePath;
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
        "Cache-Control": "public, max-age=3600",
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
      "Cache-Control": "public, max-age=3600",
    },
  });
}
