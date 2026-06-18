import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Scope: full "drive" so the app can list & read every PDF in the eBookMine
// folder, including files the user uploads manually through the Drive website.
// (The narrower drive.file scope only sees files the app itself created.)
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive",
].join(" ");

/**
 * Refresh an expired Google access token using the stored refresh token.
 */
async function refreshAccessToken(token: any) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = await res.json();
    if (!res.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      // Google returns expires_in (seconds from now).
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      // Fall back to the old refresh token if a new one wasn't returned.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          // access_type=offline + prompt=consent ensures we receive a refresh token.
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign in: account is present.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
        return token;
      }

      // Return the existing token if it has not expired yet.
      if (Date.now() < (token.accessTokenExpires as number) - 60_000) {
        return token;
      }

      // Otherwise refresh it.
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).error = token.error;
      // Only the configured owner account may manage the library. If OWNER_EMAIL
      // is unset, fall back to treating any signed-in user as the owner (handy
      // for local single-user development).
      const ownerEmail = process.env.OWNER_EMAIL;
      (session as any).isOwner = ownerEmail
        ? token.email === ownerEmail
        : true;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
