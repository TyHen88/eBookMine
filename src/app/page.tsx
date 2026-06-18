"use client";

import { useSession } from "next-auth/react";
import Library from "@/components/Library";
import PublicLibrary from "@/components/PublicLibrary";
import Header from "@/components/Header";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  // Only the owner manages their own Drive; everyone else — including a
  // signed-in non-owner — gets the public, read-only library.
  const isOwner =
    status === "authenticated" && (session as any)?.isOwner === true;

  return (
    <div className="min-h-screen">
      <Header />
      {isOwner ? <Library /> : <PublicLibrary />}
    </div>
  );
}
