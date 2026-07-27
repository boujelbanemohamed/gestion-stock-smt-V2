import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { applyTheme, getStoredTheme, storeTheme } from "@/lib/theme"

describe("applyTheme", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark")
    vi.unstubAllGlobals()
  })

  it("ajoute la classe .dark quand le thème est 'dark'", () => {
    applyTheme("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("retire la classe .dark quand le thème est 'light'", () => {
    document.documentElement.classList.add("dark")
    applyTheme("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("suit la préférence système quand le thème est 'auto'", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal("matchMedia", matchMedia)

    applyTheme("auto")

    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })
})

describe("storeTheme / getStoredTheme", () => {
  beforeEach(() => {
    // localStorage.clear() n'est pas fiable partout (ex. Node 22+ expose son propre
    // global localStorage expérimental, dont l'implémentation peut différer de celle
    // de jsdom) ; on ne retire que la clé qui nous concerne, ce qui est plus portable.
    localStorage.removeItem("theme")
  })

  it("persiste puis relit le thème choisi", () => {
    storeTheme("dark")
    expect(getStoredTheme()).toBe("dark")
  })

  it("retourne 'auto' par défaut si rien n'est mémorisé", () => {
    expect(getStoredTheme()).toBe("auto")
  })
})
