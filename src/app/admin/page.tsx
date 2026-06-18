"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import SignIn from "@/components/SignIn";
import Library from "@/components/Library";
import Header from "@/components/Header";

/**
 * /admin — owner login & management.
 * - Not signed in  → Google sign-in screen.
 * - Owner          → the management library.
 * - Signed-in but not the owner → access denied.
 */
export default function AdminPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return <SignIn />;
  }

  const isOwner = (session as any)?.isOwner === true;

  if (!isOwner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl">🚫</div>
        <h1 className="mt-4 text-xl font-semibold">Not authorized</h1>
        <p className="mt-1 max-w-sm text-slate-500 dark:text-slate-400">
          You&apos;re signed in as{" "}
          <span className="font-medium">{session.user?.email}</span>, which
          isn&apos;t the owner account for this library.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => signOut({ callbackUrl: "/admin" })}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
          <Link
            href="/"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <Library />
    </div>
  );
}
