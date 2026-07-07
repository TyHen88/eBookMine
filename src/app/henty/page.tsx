"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import SignIn from "@/components/SignIn";
import Library from "@/components/Library";
import Header from "@/components/Header";
import { buttonClass, Spinner } from "@/components/ui";
import { LockIcon } from "@/components/ui/icons";

/**
 * /henty — owner login & management (the app's only entry point).
 * - Not signed in  → Google sign-in screen.
 * - Owner          → the management library.
 * - Signed-in but not the owner → access denied.
 */
export default function HentyPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return <SignIn />;
  }

  const isOwner = (session as any)?.isOwner === true;

  if (!isOwner) {
    return (
      <div className="flex min-h-screen animate-fade-in-up flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/40">
          <LockIcon size={30} />
        </div>
        <h1 className="mt-5 text-xl font-semibold">Not authorized</h1>
        <p className="mt-1 max-w-sm text-slate-500 dark:text-slate-400">
          You&apos;re signed in as{" "}
          <span className="font-medium">{session.user?.email}</span>, which
          isn&apos;t the owner account for this library.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => signOut({ callbackUrl: "/henty" })}
            className={buttonClass({ variant: "secondary" })}
          >
            Sign out
          </button>
          <Link href="/henty" className={buttonClass({ variant: "primary" })}>
            Try again
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
