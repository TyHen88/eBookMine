"use client";

import { useSession } from "next-auth/react";
import Library from "@/components/Library";
import PublicLibrary from "@/components/PublicLibrary";
import Header from "@/components/Header";

export default function Home() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  // Signed-in owner manages their own Drive; everyone else gets the public,
  // read-only library served from the owner's account.
  return (
    <div className="min-h-screen">
      <Header />
      {status === "authenticated" ? <Library /> : <PublicLibrary />}
    </div>
  );
}
