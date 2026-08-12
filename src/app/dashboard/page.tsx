import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";

export const metadata = {
  title: "Dashboard — eBookMine",
  description: "Your reading progress, streak, reading goals, and study stats.",
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Dashboard />
      </main>
    </div>
  );
}
