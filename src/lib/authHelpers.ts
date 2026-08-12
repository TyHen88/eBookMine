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
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) return null;
  return session as AuthenticatedSession;
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
  const session = await getSession();

  // Try PostgreSQL lookup first
  try {
    const book = await prisma.book.findFirst({
      where: {
        OR: [{ id: bookId }, { driveFileId: bookId }],
      },
    });

    if (book) {
      if (book.published && book.visibility === "PUBLIC") {
        return { allowed: true, isPublic: true, response: null };
      }

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

      const isAdmin =
        session.user?.role === "ADMIN" || session.isOwner === true;
      const isOwnerOfBook =
        "userId" in book &&
        typeof (book as Record<string, unknown>).userId === "string" &&
        session.user?.id === (book as Record<string, unknown>).userId;

      if (isAdmin || isOwnerOfBook) {
        return { allowed: true, isPublic: false, response: null };
      }


      return {
        allowed: false,
        isPublic: false,
        response: NextResponse.json(
          { error: "Forbidden: Book access denied" },
          { status: 403 }
        ),
      };
    }
  } catch {
    /* fallback to session check if DB lookup fails */
  }

  // Fallback for current library.json / Drive setup
  if (session) {
    return { allowed: true, isPublic: false, response: null };
  }

  return {
    allowed: false,
    isPublic: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}
