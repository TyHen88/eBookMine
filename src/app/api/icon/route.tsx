import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/appIcon";

// PNG icon generator for the web-app manifest (Add to Home Screen).
// e.g. /api/icon?size=512 (any) or /api/icon?size=512&maskable=1 (maskable).
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const size = Math.min(
    1024,
    Math.max(48, Number(searchParams.get("size")) || 512)
  );
  const maskable = searchParams.get("maskable") === "1";

  return new ImageResponse(<IconArt size={size} maskable={maskable} />, {
    width: size,
    height: size,
  });
}
