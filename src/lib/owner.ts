// Owner-token helper for the public library.
// The site owner authorizes once; their refresh token is stored as
// OWNER_REFRESH_TOKEN so the server can read the owner's eBookMine folder and
// serve books to anonymous visitors. Access tokens are cached in memory.

let cached: { token: string; expires: number } | null = null;

/**
 * Returns an access token for the owner's Google account, or null if the
 * public library hasn't been configured (no OWNER_REFRESH_TOKEN set).
 */
export async function getOwnerAccessToken(): Promise<string | null> {
  const refreshToken = process.env.OWNER_REFRESH_TOKEN;
  if (!refreshToken) return null;

  if (cached && Date.now() < cached.expires - 60_000) return cached.token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    console.error("Owner token refresh failed:", await res.text());
    return null;
  }

  const data = await res.json();
  cached = {
    token: data.access_token,
    expires: Date.now() + data.expires_in * 1000,
  };
  return cached.token;
}

export function isPublicLibraryConfigured(): boolean {
  return Boolean(process.env.OWNER_REFRESH_TOKEN);
}
