"use client"

// Applique et persiste le thème (clair/sombre/automatique) choisi dans
// Configuration > Affichage. La classe .dark et ses variables CSS existent
// déjà dans app/globals.css ; il ne restait qu'à la piloter.

export type Theme = "light" | "dark" | "auto"

const STORAGE_KEY = "theme"

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return
  const isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", isDark)
}

export function storeTheme(theme: Theme) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, theme)
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "auto"
  return (localStorage.getItem(STORAGE_KEY) as Theme) || "auto"
}
