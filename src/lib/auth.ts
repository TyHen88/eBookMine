import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                scope: "openid email profile https://www.googleapis.com/auth/drive.file",
                access_type: "offline",
                prompt: "consent",
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        const ownerEmail = process.env.OWNER_EMAIL;
        const isOwner = ownerEmail ? email === ownerEmail.toLowerCase() : user.role === "ADMIN";

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: isOwner ? "ADMIN" : user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      if (user) {
        token.dbUserId = user.id;
        token.role = (user as any).role ?? "USER";
      } else if (token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
          });
          if (dbUser) {
            token.dbUserId = dbUser.id;
            token.role = dbUser.role;
          }
        } catch {
          /* DB lookup fallback */
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.dbUserId;
        (session.user as Record<string, unknown>).role = token.role ?? "USER";
      }

      const ownerEmail = process.env.OWNER_EMAIL;
      const isOwner =
        token.role === "ADMIN" ||
        (ownerEmail && token.email ? token.email.toLowerCase() === ownerEmail.toLowerCase() : false);

      (session as unknown as Record<string, unknown>).isOwner = isOwner;
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
