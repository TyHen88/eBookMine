"use client";

import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import Library from "@/components/Library";
import PublicLibrary from "@/components/PublicLibrary";
import { Spinner } from "@/components/ui";

export default function LibraryPage() {
  const { status } = useSession();

  return (
    <div className="min-h-screen">
      <Header />
      {status === "loading" ? (
        <div className="flex h-72 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : status === "authenticated" ? (
        <Library />
      ) : (
        <PublicLibrary />
      )}
    </div>
  );
}
