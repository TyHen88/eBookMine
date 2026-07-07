"use client";

import { useTheme } from "./Providers";
import { IconButton } from "./ui";
import { MoonIcon, SunIcon } from "./ui/icons";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <IconButton
      onClick={toggle}
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to light" : "Switch to dark"}
    >
      <span className="transition-transform duration-500 hover:rotate-45">
        {isDark ? (
          <SunIcon size={19} className="animate-pop-in" />
        ) : (
          <MoonIcon size={18} className="animate-pop-in" />
        )}
      </span>
    </IconButton>
  );
}
