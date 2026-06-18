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

  return NextResponse.json({
    refreshToken: (token as any).refreshToken ?? null,
    note: "Set this value as OWNER_REFRESH_TOKEN in .env.local, then restart the server. Keep it secret.",
  });
}
