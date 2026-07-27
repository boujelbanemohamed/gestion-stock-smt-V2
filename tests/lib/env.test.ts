import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

describe("lib/env", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("getServerApiUrl() renvoie l'URL publique configurée", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db"
    process.env.NEXT_PUBLIC_API_URL = "https://example.com"

    const { getServerApiUrl } = await import("@/lib/env")
    expect(getServerApiUrl()).toBe("https://example.com")
  })

  it("getServerApiUrl() retombe sur localhost:3000 si l'URL publique n'est pas définie", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db"
    delete process.env.NEXT_PUBLIC_API_URL

    const { getServerApiUrl } = await import("@/lib/env")
    expect(getServerApiUrl()).toBe("http://localhost:3000")
  })

  it("continue avec des valeurs de repli en développement si DATABASE_URL est manquant (ne bloque pas le démarrage)", async () => {
    delete process.env.DATABASE_URL
    process.env.NODE_ENV = "development"

    const { env } = await import("@/lib/env")
    expect(env.DATABASE_URL).toBeTruthy()
    expect(env.NODE_ENV).toBe("development")
  })

  it("lève une erreur au chargement du module en production si DATABASE_URL est manquant", async () => {
    delete process.env.DATABASE_URL
    process.env.NODE_ENV = "production"

    await expect(import("@/lib/env")).rejects.toThrow(/Variables d'environnement invalides ou manquantes/)
  })

  it("expose l'URL publique validée quand elle est fournie", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db"
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com"

    const { publicEnvValidated } = await import("@/lib/env")
    expect(publicEnvValidated.NEXT_PUBLIC_API_URL).toBe("https://api.example.com")
  })
})
