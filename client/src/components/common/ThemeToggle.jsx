import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const ThemeToggle = ({ compact = false, floating = false, className = "" }) => {
  const { isDark, toggleTheme } = useTheme();
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Light mode" : "Dark mode";

  const positionClass = floating
    ? "fixed bottom-4 right-4 z-[1000] shadow-xl shadow-black/20"
    : "";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={compact ? label : undefined}
      className={`theme-toggle inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/50 ${
        compact ? "w-10 px-0" : ""
      } ${positionClass} ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {!compact && <span>{label}</span>}
    </button>
  );
};

export default ThemeToggle;
