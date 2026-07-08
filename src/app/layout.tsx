import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ScrollToTop from "@/components/ScrollToTop";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "eBookMine — Your PDF library in Google Drive",
  description:
    "A personal eBook library. Sign in with Google and keep your PDFs in your own Drive.",
  appleWebApp: {
    capable: true,
    title: "eBookMine",
    statusBarStyle: "default",
  },
  // Favicon (src/app/icon.svg) and the Apple touch icon (src/app/apple-icon.tsx)
  // are picked up automatically via the App Router file conventions.
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
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
        <ScrollToTop />
      </body>
    </html>
  );
}
