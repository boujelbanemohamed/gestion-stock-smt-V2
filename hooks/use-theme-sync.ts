"use client"

import { useEffect } from "react"
import { authenticatedFetch } from "@/lib/api-client"
import { applyTheme, getStoredTheme, storeTheme, type Theme } from "@/lib/theme"

// Applique le thème déjà mis en cache (voir le script d'amorçage dans
// app/layout.tsx, qui évite le flash au chargement), puis le synchronise avec
// la valeur configurée dans Configuration > Affichage, et suit les
// changements de préférence système tant que le thème choisi est "Automatique".
export function useThemeSync() {
  useEffect(() => {
    let currentTheme = getStoredTheme()

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onMediaChange = () => {
      if (currentTheme === "auto") applyTheme("auto")
    }
    media.addEventListener("change", onMediaChange)
    ;(async () => {
      try {
        const response = await authenticatedFetch("/api/config")
        const data = await response.json()
        const configuredTheme: Theme = data?.data?.display?.theme || "auto"
        if (configuredTheme !== currentTheme) {
          currentTheme = configuredTheme
          storeTheme(configuredTheme)
          applyTheme(configuredTheme)
        }
      } catch (error) {
        console.error("Error loading theme config:", error)
      }
    })()

    return () => media.removeEventListener("change", onMediaChange)
  }, [])
}
