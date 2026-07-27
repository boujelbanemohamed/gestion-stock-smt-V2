import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createRateLimiter } from "@/lib/rate-limiter"

function makeRequest(ip: string) {
  return new NextRequest("http://localhost/api/test", {
    headers: new Headers({ "x-forwarded-for": ip }),
  })
}

describe("createRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("autorise les requêtes tant que la limite n'est pas dépassée", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3 })
    const req = makeRequest("1.2.3.4")
    expect(limiter(req)).toBeNull()
    expect(limiter(req)).toBeNull()
    expect(limiter(req)).toBeNull()
  })

  it("bloque au-delà de la limite avec un 429 et les en-têtes Retry-After / X-RateLimit-*", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, message: "Trop de requêtes" })
    const req = makeRequest("5.6.7.8")
    expect(limiter(req)).toBeNull()
    expect(limiter(req)).toBeNull()

    const blocked = limiter(req)
    expect(blocked).not.toBeNull()
    expect(blocked?.status).toBe(429)
    expect(blocked?.headers.get("Retry-After")).toBeTruthy()
    expect(blocked?.headers.get("X-RateLimit-Limit")).toBe("2")
    expect(blocked?.headers.get("X-RateLimit-Remaining")).toBe("0")

    const json = await blocked?.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe("Trop de requêtes")
  })

  it("suit des compteurs indépendants par clé (par défaut, l'IP)", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 })
    const reqA = makeRequest("9.9.9.9")
    const reqB = makeRequest("8.8.8.8")

    expect(limiter(reqA)).toBeNull()
    expect(limiter(reqB)).toBeNull() // clé différente : pas affectée par reqA
    expect(limiter(reqA)).not.toBeNull() // reqA a déjà atteint sa limite
  })

  it("respecte un keyGenerator personnalisé", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      keyGenerator: () => "toujours-la-meme-cle",
    })
    const reqA = makeRequest("1.1.1.1")
    const reqB = makeRequest("2.2.2.2")

    expect(limiter(reqA)).toBeNull()
    // Même clé malgré des IP différentes : la seconde requête est bloquée.
    expect(limiter(reqB)).not.toBeNull()
  })

  it("réinitialise le compteur une fois la fenêtre de temps expirée", () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1 })
    const req = makeRequest("3.3.3.3")

    expect(limiter(req)).toBeNull()
    expect(limiter(req)).not.toBeNull() // limite atteinte dans la fenêtre courante

    vi.advanceTimersByTime(1001)
    expect(limiter(req)).toBeNull() // nouvelle fenêtre : le compteur repart à zéro
  })

  it("utilise x-real-ip si x-forwarded-for est absent", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 })
    const req = new NextRequest("http://localhost/api/test", {
      headers: new Headers({ "x-real-ip": "7.7.7.7" }),
    })
    expect(limiter(req)).toBeNull()
    expect(limiter(req)).not.toBeNull()
  })
})
