"use client";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-400"
      aria-label={`切换到${isDark ? "浅色学院风" : "深色科技风"}`}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border"
      >
        <span className="h-1.5 w-1.5 rounded-full" />
      </span>
      {compact ? null : <span>{isDark ? "浅色学院风" : "深色科技风"}</span>}
    </button>
  );
}
