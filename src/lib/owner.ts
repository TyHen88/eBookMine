// Public-library configuration.
//
// The public library needs NO stored credential and nothing that expires. The
// owner's `eBookMine` folder is shared "anyone with the link" (done
// automatically by the app whenever the owner is signed in — see
// ensureFolderPublic in drive.ts), and the public routes read it with the
// already-public Google API key.
//
// The only thing the server must know is *which* folder to read — its Drive id.
// A folder id is not a secret and never expires; set it as EBOOKMINE_FOLDER_ID.

/**
 * The owner's eBookMine folder id, or null if the public library isn't set up.
 */
export function getPublicFolderId(): string | null {
  return process.env.EBOOKMINE_FOLDER_ID || null;
}

/**
 * True once the public library can be served: a folder id plus a server-usable
 * API key (a dedicated DRIVE_API_KEY, or the public key as a fallback).
 */
export function isPublicLibraryConfigured(): boolean {
  return Boolean(
    process.env.EBOOKMINE_FOLDER_ID &&
      (process.env.DRIVE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
  );
}
