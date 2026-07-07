import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "eBookMine — Your PDF library in Google Drive",
    short_name: "eBookMine",
    description:
      "A personal eBook library. Sign in with Google and keep your PDFs in your own Drive.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef2ff",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/api/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/icon?size=192&maskable=1",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/api/icon?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
