import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { getOrCreateAppFolderInfo, APP_FOLDER_NAME } from "@/lib/drive";
import { requireAuth } from "@/lib/authHelpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/folder — ensure the app folder exists and return a link to open it
 * in Google Drive. Useful for confirming where books are stored.
 */
export async function GET() {
  const { session, response } = await requireAuth();
  if (response) return response;

  const token = await getAccessToken();
  if (token) {
    try {
      const folder = await getOrCreateAppFolderInfo(token);
      return NextResponse.json({
        name: APP_FOLDER_NAME,
        id: folder.id,
        webViewLink:
          folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
      });
    } catch (err: any) {
      console.warn("Drive API access failed, falling back to env folder ID:", err?.message);
    }
  }

  // Fallback for Credentials sign-in when EBOOKMINE_FOLDER_ID is configured
  const envFolderId = process.env.EBOOKMINE_FOLDER_ID;
  if (envFolderId) {
    return NextResponse.json({
      name: APP_FOLDER_NAME,
      id: envFolderId,
      webViewLink: `https://drive.google.com/drive/folders/${envFolderId}`,
    });
  }

  return NextResponse.json({
    name: APP_FOLDER_NAME,
    id: null,
    webViewLink: null,
  });
}

