import { Suspense } from "react";
import Header from "@/components/Header";
import AiTutorView from "@/components/AiTutorView";
import { Spinner } from "@/components/ui";

export const metadata = {
  title: "AI Study Tutor — eBookMine",
  description: "Your personal AI study companion for eBookMine.",
};

export default function AiTutorPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1380px] flex-1 px-4 sm:px-6 pt-4 sm:pt-6 pb-28 md:pb-12 md:pl-24 md:pr-10">
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
