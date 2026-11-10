"use client";

import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle theme"
      className={`p-1.5 rounded-lg text-ql-muted hover:text-ql-text hover:bg-ql-bg/80 border border-ql-border/60 transition-colors cursor-pointer ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-ql-accent" />
      ) : (
        <Moon className="w-4 h-4 text-ql-muted" />
      )}
    </button>
  );
}
