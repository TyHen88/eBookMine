import Header from "@/components/Header";
import AiTutorView from "@/components/AiTutorView";

export const metadata = {
  title: "AI Tutor — eBookMine",
  description: "Your personal AI study companion for eBookMine.",
};

export default function AiTutorPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <AiTutorView />
      </main>
    </div>
  );
}
