"use client";

import PublicLibrary from "@/components/PublicLibrary";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// The home page is the public, read-only library for everyone.
// Owner management lives at /admin.
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <PublicLibrary />
      </div>
      <Footer />
    </div>
  );
}
