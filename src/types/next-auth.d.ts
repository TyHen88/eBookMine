import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: string;
    } & DefaultSession["user"];
    isOwner?: boolean;
    accessToken?: string;
  }

  interface User {
    id?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    dbUserId?: string;
    role?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
