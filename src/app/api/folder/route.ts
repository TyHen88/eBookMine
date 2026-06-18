import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { getOrCreateAppFolderInfo, APP_FOLDER_NAME } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/folder — ensure the app folder exists and return a link to open it
 * in Google Drive. Useful for confirming where books are stored.
 */
export async function GET() {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const folder = await getOrCreateAppFolderInfo(token);
    return NextResponse.json({
      name: APP_FOLDER_NAME,
      id: folder.id,
      webViewLink:
        folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to access Drive folder" },
      { status: 500 }
    );
  }
}
