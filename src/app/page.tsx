"use client";

import PublicLibrary from "@/components/PublicLibrary";
import Header from "@/components/Header";

// The home page is the public, read-only library for everyone.
// Owner management lives at /admin.
export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <PublicLibrary />
    </div>
  );
}
