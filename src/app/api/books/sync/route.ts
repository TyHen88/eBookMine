import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { syncFromDrive, syncFromPublicDrive } from "@/lib/bookSyncService";
import { getOrCreateAppFolder } from "@/lib/drive";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/books/sync — manually trigger synchronization between Google Drive and PostgreSQL.
 */
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const token = session.accessToken;
    let folderId = process.env.EBOOKMINE_FOLDER_ID;

    let stats;
    if (token) {
      if (!folderId) {
        try {
          folderId = await getOrCreateAppFolder(token);
        } catch {}
      }
      if (!folderId) {
        return NextResponse.json({ error: "Could not locate Drive folder" }, { status: 400 });
      }
      stats = await syncFromDrive(token, folderId, session.user?.id);
    } else if (folderId) {
      stats = await syncFromPublicDrive(folderId);
    } else {
      return NextResponse.json(
        { error: "No Drive folder configured (set EBOOKMINE_FOLDER_ID or log in with Google)" },
        { status: 400 }
      );
    }

    logger.info("Drive sync completed", { stats, userId: session.user?.id });
    return NextResponse.json({ ok: true, stats });
  } catch (err: unknown) {
    logger.error("POST /api/books/sync failed", err);
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
