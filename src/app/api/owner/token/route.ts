import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

/**
 * GET /api/owner/token — ONE-TIME SETUP HELPER.
 * Sign in as the owner, then open this endpoint to read your Google refresh
 * token. Copy it into OWNER_REFRESH_TOKEN in your env to enable the public
 * library. (Returns null if you signed in before a refresh token was granted —
 * sign out and back in to force re-consent.)
 */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  // Only the owner may read a refresh token here. If OWNER_EMAIL is unset we
  // allow it (single-user/local setup, where you are by definition the owner).
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail && token.email !== ownerEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    refreshToken: (token as any).refreshToken ?? null,
    note: "Set this value as OWNER_REFRESH_TOKEN in .env.local, then restart the server. Keep it secret.",
  });
}
