"use client";

import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-3 sm:px-6 pt-3 sm:pt-6 pb-28 md:pb-12 md:pl-24 md:pr-10">
        <Dashboard />
      </main>
    </div>
  );
}
