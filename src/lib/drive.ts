// Thin wrapper around the Google Drive REST API v3.
// Every function takes the user's OAuth access token and acts on the
// dedicated "eBookMine" folder (and only files the app created).

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export const APP_FOLDER_NAME = "eBookMine";
export const METADATA_FILE_NAME = "library.json";

type Token = string;

function authHeaders(token: Token, extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

// Server-side API key for reading files shared "anyone with the link" — no
// OAuth token, nothing that expires. Prefer a dedicated server key (DRIVE_API_KEY)
// because the NEXT_PUBLIC key is usually HTTP-referrer restricted for the browser
// Picker, and referrer restrictions block server-to-server calls (no referrer).
function apiKey(): string {
  return (
    process.env.DRIVE_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
    ""
  );
}

async function keyedFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}key=${apiKey()}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API error ${res.status}: ${text}`);
  }
  return res;
}

async function driveFetch(token: Token, url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: authHeaders(token, (init.headers as Record<string, string>) ?? {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API error ${res.status}: ${text}`);
  }
  return res;
}

export interface AppFolder {
  id: string;
  webViewLink: string;
}

/**
 * Find the app folder, creating it if it does not exist.
 * Returns its id plus a webViewLink the user can open in Drive.
 */
export async function getOrCreateAppFolderInfo(
  token: Token
): Promise<AppFolder> {
  const q = encodeURIComponent(
    `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await driveFetch(
    token,
    `${DRIVE_API}/files?q=${q}&fields=files(id,name,webViewLink)&spaces=drive`
  );
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    const f = data.files[0];
    await ensureFolderPublic(token, f.id);
    return { id: f.id, webViewLink: f.webViewLink ?? "" };
  }

  const createRes = await driveFetch(
    token,
    `${DRIVE_API}/files?fields=id,webViewLink`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    }
  );
  const created = await createRes.json();
  await ensureFolderPublic(token, created.id);
  return { id: created.id, webViewLink: created.webViewLink ?? "" };
}

/**
 * Share the app folder as "anyone with the link → reader" so its files (current
 * and future) are publicly readable via the API key. Idempotent and best-effort:
 * a duplicate/pre-existing permission is fine and is swallowed.
 */
export async function ensureFolderPublic(
  token: Token,
  folderId: string
): Promise<void> {
  try {
    await driveFetch(
      token,
      `${DRIVE_API}/files/${folderId}/permissions?fields=id`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      }
    );
  } catch {
    // Already shared, or the account lacks permission to share — non-fatal.
  }
}

/**
 * Convenience wrapper returning only the folder id (most callers need just this).
 */
export async function getOrCreateAppFolder(token: Token): Promise<string> {
  const { id } = await getOrCreateAppFolderInfo(token);
  return id;
}

export interface DriveFile {
  id: string;
  name: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  hasThumbnail?: boolean;
}

/**
 * List every PDF in the app folder, following pagination so large libraries
 * (hundreds/thousands of files) are returned in full.
 */
export async function listPdfFiles(
  token: Token,
  folderId: string
): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`
  );
  const fields = encodeURIComponent(
    "nextPageToken,files(id,name,size,createdTime,modifiedTime,hasThumbnail)"
  );

  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url =
      `${DRIVE_API}/files?q=${q}&fields=${fields}` +
      `&orderBy=createdTime desc&pageSize=1000` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const res = await driveFetch(token, url);
    const data = await res.json();
    if (Array.isArray(data.files)) out.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

/**
 * Upload a PDF (or any binary) to the app folder using a multipart request.
 */
export async function uploadFile(
  token: Token,
  folderId: string,
  name: string,
  mimeType: string,
  bytes: ArrayBuffer | Buffer
): Promise<DriveFile> {
  const boundary = "ebookmine_boundary_" + Math.floor(performance.now());
  const metadata = { name, parents: [folderId] };

  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);
  const body = Buffer.concat([
    Buffer.from(head),
    Buffer.from(bytes as ArrayBuffer),
    Buffer.from(tail),
  ]);

  const res = await driveFetch(
    token,
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,size,createdTime,modifiedTime`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  return res.json();
}

/**
 * Download a file's binary content. Returns the raw Response so callers can
 * stream it. Pass an HTTP `Range` header to fetch only a byte slice — Drive's
 * `alt=media` endpoint honours it and replies 206, which lets pdf.js load large
 * PDFs page-by-page instead of pulling the whole file into memory.
 */
export async function downloadFile(
  token: Token,
  fileId: string,
  range?: string
) {
  return driveFetch(
    token,
    `${DRIVE_API}/files/${fileId}?alt=media`,
    range ? { headers: { Range: range } } : {}
  );
}

/**
 * Fetch Drive's auto-generated thumbnail for a file (used as a cover image).
 * Returns the image Response, or null if no thumbnail is available.
 */
export async function fetchThumbnail(
  token: Token,
  fileId: string,
  size = 400
): Promise<Response | null> {
  const metaRes = await driveFetch(
    token,
    `${DRIVE_API}/files/${fileId}?fields=thumbnailLink`
  );
  const { thumbnailLink } = await metaRes.json();
  if (!thumbnailLink) return null;

  // thumbnailLink ends with a size hint like "=s220"; bump it for sharper covers.
  const url = thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  const imgRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return imgRes.ok ? imgRes : null;
}

export async function deleteFile(token: Token, fileId: string) {
  await driveFetch(token, `${DRIVE_API}/files/${fileId}`, { method: "DELETE" });
}

const FILE_FIELDS = "id,name,size,createdTime,modifiedTime";

/**
 * Move a file (e.g. one picked via the Google Picker) into the app folder by
 * adding the folder as a parent and removing its previous parents.
 */
export async function moveFileToFolder(
  token: Token,
  fileId: string,
  folderId: string
): Promise<DriveFile> {
  const metaRes = await driveFetch(
    token,
    `${DRIVE_API}/files/${fileId}?fields=parents`
  );
  const { parents } = await metaRes.json();
  const remove = Array.isArray(parents) ? parents.join(",") : "";

  const url =
    `${DRIVE_API}/files/${fileId}?addParents=${folderId}` +
    (remove ? `&removeParents=${encodeURIComponent(remove)}` : "") +
    `&fields=${encodeURIComponent(FILE_FIELDS)}`;
  const res = await driveFetch(token, url, { method: "PATCH" });
  return res.json();
}

/**
 * Copy a file into the app folder. Used as a fallback when a move is not
 * permitted (the copy is app-created, so it is fully manageable afterwards).
 */
export async function copyFileToFolder(
  token: Token,
  fileId: string,
  folderId: string,
  name?: string
): Promise<DriveFile> {
  const res = await driveFetch(
    token,
    `${DRIVE_API}/files/${fileId}/copy?fields=${encodeURIComponent(FILE_FIELDS)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parents: [folderId], ...(name ? { name } : {}) }),
    }
  );
  return res.json();
}

export async function renameFile(token: Token, fileId: string, name: string) {
  const res = await driveFetch(token, `${DRIVE_API}/files/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

/**
 * Find a file by exact name inside a folder. Returns its id or null.
 */
export async function findFileByName(
  token: Token,
  folderId: string,
  name: string
): Promise<string | null> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name='${name}' and trashed=false`
  );
  const res = await driveFetch(
    token,
    `${DRIVE_API}/files?q=${q}&fields=files(id,name)`
  );
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

/**
 * Overwrite an existing file's media content (used for the metadata JSON).
 */
export async function updateFileContent(
  token: Token,
  fileId: string,
  mimeType: string,
  bytes: ArrayBuffer | Buffer
) {
  await driveFetch(
    token,
    `${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: { "Content-Type": mimeType },
      body: Buffer.from(bytes as ArrayBuffer),
    }
  );
}

// --- Token-free public reads (API key + publicly-shared folder) -------------

/**
 * List every PDF in a publicly-shared folder using only the API key.
 * Mirrors listPdfFiles but requires no OAuth token.
 */
export async function listPublicPdfFiles(
  folderId: string
): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`
  );
  const fields = encodeURIComponent(
    "nextPageToken,files(id,name,size,createdTime,modifiedTime,hasThumbnail)"
  );

  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url =
      `${DRIVE_API}/files?q=${q}&fields=${fields}` +
      `&orderBy=createdTime desc&pageSize=1000` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const res = await keyedFetch(url);
    const data = await res.json();
    if (Array.isArray(data.files)) out.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

/**
 * Find a file by exact name inside a publicly-shared folder (API key only).
 */
export async function findPublicFileByName(
  folderId: string,
  name: string
): Promise<string | null> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name='${name}' and trashed=false`
  );
  try {
    const res = await keyedFetch(
      `${DRIVE_API}/files?q=${q}&fields=files(id,name)`
    );
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  } catch {
    return null;
  }
}

/**
 * Download a publicly-shared file's binary content (API key only). Returns the
 * raw Response so callers can stream it.
 */
export async function downloadPublicFile(
  fileId: string,
  range?: string
): Promise<Response> {
  return keyedFetch(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    range ? { headers: { Range: range } } : {}
  );
}

/**
 * Public thumbnail URL for a shared file. Google serves these without auth for
 * link-shared files, so it doubles as a cover fallback for the public library.
 */
export function publicThumbnailUrl(fileId: string, size = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}
