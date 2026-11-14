"use client";

import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1380px] flex-1 px-4 sm:px-6 pt-4 sm:pt-6 pb-28 md:pb-14 md:pl-24 md:pr-10">
        <Dashboard />
      </main>
    </div>
  );
}
