import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const THEME_STORAGE_KEY = "tapvera-theme";
const THEMES = ["light", "dark"];
const DEFAULT_THEME = "dark";

const ThemeContext = createContext(null);

const getStoredTheme = () => {
  if (typeof window === "undefined") return DEFAULT_THEME;

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(storedTheme) ? storedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

export const applyTheme = (theme) => {
  if (typeof document === "undefined") return;

  const nextTheme = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  const root = document.documentElement;

  root.classList.add("tapvera-ui");
  root.classList.remove("light", "dark");
  root.classList.add(nextTheme);
  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme;

  const themeColor = nextTheme === "dark" ? "#07080d" : "#f8fafc";
  let themeMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement("meta");
    themeMeta.setAttribute("name", "theme-color");
    document.head.appendChild(themeMeta);
  }
  themeMeta.setAttribute("content", themeColor);
};

export const initializeTheme = () => {
  applyTheme(getStoredTheme());
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme persistence is a convenience; the app can continue without storage.
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(THEMES.includes(nextTheme) ? nextTheme : DEFAULT_THEME);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      isLight: theme === "light",
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
