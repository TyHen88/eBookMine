import { Suspense } from "react";
import Header from "@/components/Header";
import AiTutorView from "@/components/AiTutorView";
import { Spinner } from "@/components/ui";

export const metadata = {
  title: "AI Tutor — eBookMine",
  description: "Your personal AI study companion for eBookMine.",
};

export default function AiTutorPage() {
  return (
    <div className="min-h-screen">
      <Header />
      {/* Bottom padding pb-36 sm:pb-28 ensures ample space above floating bottom navbar */}
      <main className="mx-auto max-w-6xl px-4 py-5 pb-36 sm:pb-28">
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          }
        >
          <AiTutorView />
        </Suspense>
      </main>
    </div>
  );
}
