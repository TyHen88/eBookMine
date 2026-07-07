import type { ReactElement } from "react";

/**
 * The eBookMine app-icon artwork (books on a shelf), composed from plain
 * flex boxes so it renders reliably through `next/og`'s Satori engine — used
 * for the PWA "Add to Home Screen" icons and the Apple touch icon.
 *
 * `maskable` fills the whole square with the indigo gradient and keeps the
 * glyph inside the safe zone, so Android/iOS can apply their own rounded mask.
 */
export function IconArt({
  size,
  maskable = false,
}: {
  size: number;
  maskable?: boolean;
}): ReactElement {
  // Glyph footprint: smaller for maskable so nothing is clipped by the mask.
  const inner = size * (maskable ? 0.5 : 0.62);
  const bar = inner * 0.15;
  const gap = bar * 0.6;

  const spine = (heightFactor: number, extra?: Record<string, string>) => (
    <div
      style={{
        width: bar,
        height: inner * heightFactor,
        background: "#ffffff",
        borderRadius: bar * 0.4,
        ...extra,
      }}
    />
  );

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #4f46e5, #818cf8)",
        borderRadius: maskable ? 0 : size * 0.22,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap }}>
          {spine(0.62)}
          {spine(0.82)}
          {spine(0.72)}
          {spine(0.78, {
            transform: "rotate(11deg)",
            transformOrigin: "bottom right",
          })}
        </div>
        <div
          style={{
            width: inner * 0.72,
            height: bar * 0.5,
            marginTop: bar * 0.45,
            background: "#ffffff",
            borderRadius: bar * 0.4,
          }}
        />
      </div>
    </div>
  );
}
