import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Returns the current user's Google access token, or null if not signed in.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return (session as any).accessToken ?? null;
}
