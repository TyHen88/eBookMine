import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Indigo brand scale. Every component references `brand-*`, so this
        // single scale defines the app's identity color.
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      // Motion system — reusable, GPU-friendly animations used across the UI.
      // All entrance animations use `both` so the element stays hidden until it
      // plays (no flash of un-animated content).
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          from: { opacity: "0", transform: "translateY(-14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(.8)" },
          "60%": { transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        blob: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(28px, -32px) scale(1.12)" },
          "66%": { transform: "translate(-24px, 18px) scale(0.92)" },
        },
        shimmer: {
          "100%": { transform: "translateX(200%)" },
        },
        "bar-grow": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in .4s ease-out both",
        "fade-in-up": "fade-in-up .55s cubic-bezier(.22,1,.36,1) both",
        "fade-in-down": "fade-in-down .5s cubic-bezier(.22,1,.36,1) both",
        "scale-in": "scale-in .22s cubic-bezier(.22,1,.36,1) both",
        "pop-in": "pop-in .35s cubic-bezier(.34,1.56,.64,1) both",
        float: "float 6s ease-in-out infinite",
        blob: "blob 20s ease-in-out infinite",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "bar-grow": "bar-grow .6s cubic-bezier(.22,1,.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
