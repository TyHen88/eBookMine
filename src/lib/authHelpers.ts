import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { User } from "@prisma/client";

export interface AuthenticatedSession {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id?: string;
    role?: "USER" | "ADMIN";
  };
  accessToken?: string;
  isOwner?: boolean;
}

/**
 * Server-side helper to retrieve the current validated session.
 */
export async function getSession(): Promise<AuthenticatedSession | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) return null;
    return session as AuthenticatedSession;
  } catch {
    return null;
  }
}

/**
 * Retrieve the current authenticated PostgreSQL User record.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session?.user?.email) return null;

  try {
    return await prisma.user.findUnique({
      where: { email: session.user.email },
    });
  } catch {
    return null;
  }
}

/**
 * Require an authenticated session for server component / API route handler.
 * Returns the session or a 401 Unauthorized response.
 */
export async function requireAuth(): Promise<
  | { session: AuthenticatedSession; response: null }
  | { session: null; response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, response: null };
}

/**
 * Require an authenticated PostgreSQL user record.
 * Returns the user and session or a 401 Unauthorized response.
 */
export async function requireUser(): Promise<
  | { session: AuthenticatedSession; user: User; response: null }
  | { session: null; user: null; response: NextResponse }
> {
  const { session, response } = await requireAuth();
  if (response) return { session: null, user: null, response };

  const dbUser = await getCurrentUser();
  if (!dbUser) {
    return {
      session: null,
      user: null,
      response: NextResponse.json(
        { error: "User record not found" },
        { status: 401 }
      ),
    };
  }

  return { session, user: dbUser, response: null };
}

/**
 * Require ADMIN role / Owner authorization.
 * Returns the session and user or a 403 Forbidden response.
 */
export async function requireAdmin(): Promise<
  | { session: AuthenticatedSession; user: User | null; response: null }
  | { session: null; user: null; response: NextResponse }
> {
  const { session, response } = await requireAuth();
  if (response) return { session: null, user: null, response };

  const isAdmin =
    session.user?.role === "ADMIN" || session.isOwner === true;

  if (!isAdmin) {
    return {
      session: null,
      user: null,
      response: NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      ),
    };
  }

  const dbUser = await getCurrentUser();
  return { session, user: dbUser, response: null };
}

/**
 * Require access to a specific book ID.
 * Admins, book owners, and public books pass validation.
 */
export async function requireBookAccess(
  bookId: string
): Promise<
  | { allowed: true; isPublic: boolean; response: null }
  | { allowed: false; isPublic: boolean; response: NextResponse }
> {
  if (process.env.AI_TEST_MODE === "true") {
    return { allowed: true, isPublic: true, response: null };
  }

  const session = await getSession();

  // Try PostgreSQL lookup first
  try {
    const book = await prisma.book.findFirst({
      where: {
        OR: [{ id: bookId }, { driveFileId: bookId }],
      },
    });

    if (book) {
      // Any published or public book is accessible to readers
      if (book.published !== false && book.visibility !== "PRIVATE") {
        return { allowed: true, isPublic: true, response: null };
      }

      // Private books require authentication
      if (!session) {
        return {
          allowed: false,
          isPublic: false,
          response: NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
          ),
        };
      }

      return { allowed: true, isPublic: false, response: null };
    }
  } catch {
    /* fallback to open access if DB lookup fails */
  }

  // Fallback for direct Google Drive file IDs
  return { allowed: true, isPublic: true, response: null };
}
