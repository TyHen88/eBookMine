import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ScrollToTop from "@/components/ScrollToTop";
import VerticalNav from "@/components/VerticalNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "eBookMine — Read, Understand & Remember Books with AI",
  description:
    "Your personal eBook library powered by AI. Read, analyze, search multi-page vector embeddings, and master topics with smart flashcards.",
  openGraph: {
    title: "eBookMine — Read, Understand & Remember Books with AI",
    description:
      "Your personal eBook library powered by AI. Read, analyze, search multi-page vector embeddings, and master topics with smart flashcards.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "eBookMine — Read, Understand & Remember Books with AI",
    description:
      "Your personal eBook library powered by AI. Read, analyze, search multi-page vector embeddings, and master topics with smart flashcards.",
  },
  appleWebApp: {
    capable: true,
    title: "eBookMine",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  // Lock the browser's own zoom: no pinch-to-zoom of the whole page, and no
  // iOS auto-zoom when a search/text input is focused. The reader has its own
  // in-app zoom (the +/- controls), which is what should scale the page.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <VerticalNav />
          {children}
        </Providers>
        <ScrollToTop />
      </body>
    </html>
  );
}
