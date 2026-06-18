import {
  METADATA_FILE_NAME,
  findFileByName,
  downloadFile,
  uploadFile,
  updateFileContent,
} from "./drive";

export interface Bookmark {
  page: number;
  label: string;
  createdAt: string;
}

export interface BookMeta {
  // Drive file id of the PDF — also the book's primary key.
  id: string;
  title: string;
  author: string;
  fileName: string;
  pageCount: number;
  category: string;
  tags: string[];
  favorite: boolean;
  // base64 data URL of the cover thumbnail (small JPEG/PNG).
  cover: string | null;
  addedAt: string;
  // Reading progress
  lastPage: number;
  bookmarks: Bookmark[];
  sizeBytes: number;
}

export interface Library {
  version: number;
  books: Record<string, BookMeta>;
}

const EMPTY_LIBRARY: Library = { version: 1, books: {} };

/**
 * Load the library.json from the app folder. Returns an empty library if absent.
 */
export async function loadLibrary(
  token: string,
  folderId: string
): Promise<Library> {
  const fileId = await findFileByName(token, folderId, METADATA_FILE_NAME);
  if (!fileId) return { ...EMPTY_LIBRARY };

  try {
    const res = await downloadFile(token, fileId);
    const data = (await res.json()) as Library;
    if (!data.books) return { ...EMPTY_LIBRARY };
    return data;
  } catch {
    return { ...EMPTY_LIBRARY };
  }
}

/**
 * Persist the library.json, creating the file on first save.
 */
export async function saveLibrary(
  token: string,
  folderId: string,
  library: Library
): Promise<void> {
  const json = JSON.stringify(library, null, 2);
  const bytes = new TextEncoder().encode(json);

  const fileId = await findFileByName(token, folderId, METADATA_FILE_NAME);
  if (fileId) {
    await updateFileContent(token, fileId, "application/json", bytes);
  } else {
    await uploadFile(
      token,
      folderId,
      METADATA_FILE_NAME,
      "application/json",
      bytes
    );
  }
}
