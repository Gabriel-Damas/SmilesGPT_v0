import { useCallback, useEffect, useMemo, useState } from "react"

type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "chatbot-smiles-theme"

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark" || stored === "system") return stored
  return "system"
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const effectiveTheme = theme === "system" ? getSystemTheme() : theme

  if (effectiveTheme === "dark") root.classList.add("dark")
  else root.classList.remove("dark")
}

export function useTheme() {
  // Initialize lazily to avoid issues during first render.
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme())

  const resolvedTheme = useMemo(
    () => (theme === "system" ? getSystemTheme() : theme),
    [theme]
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    // Keep sync with system changes when in "system".
    if (theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => applyTheme("system")

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme(newTheme)
  }, [])

  const toggleLightDark = useCallback(() => {
    const next = resolvedTheme === "light" ? "dark" : "light"
    setTheme(next)
  }, [resolvedTheme, setTheme])

  const toggleThemeCycle = useCallback(() => {
    const next: Theme =
      theme === "system" ? "light" : theme === "light" ? "dark" : "system"
    setTheme(next)
  }, [theme, setTheme])

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === "dark",
    isLight: resolvedTheme === "light",
    setTheme,
    toggleLightDark,
    toggleThemeCycle,
  }
}

export type { Theme }

