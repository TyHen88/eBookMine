import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/appIcon";

// Apple touch icon for iOS "Add to Home Screen". iOS applies its own rounded
// mask, so we render full-bleed (maskable) art.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<IconArt size={180} maskable />, { ...size });
}
