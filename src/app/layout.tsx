import type { Metadata, Viewport } from "next";
import { Inter, Kantumruy_Pro, Noto_Sans_Khmer } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ScrollToTop from "@/components/ScrollToTop";
import VerticalNav from "@/components/VerticalNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const kantumruy = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  variable: "--font-khmer",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
const notoSansKhmer = Noto_Sans_Khmer({
  subsets: ["khmer", "latin"],
  variable: "--font-noto-khmer",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@100..900&family=Kantumruy+Pro:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning className={`${inter.variable} ${kantumruy.variable} ${notoSansKhmer.variable} font-sans antialiased`}>
        <Providers>
          <VerticalNav />
          {children}
        </Providers>
        <ScrollToTop />
      </body>
    </html>
  );
}
