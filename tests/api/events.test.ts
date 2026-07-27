import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { GET } = await import("@/app/api/events/route")

function eventsRequest(token: string | null, controller: AbortController) {
  const url = token ? `http://localhost/api/events?token=${encodeURIComponent(token)}` : "http://localhost/api/events"
  return new NextRequest(url, { signal: controller.signal })
}

describe("GET /api/events (SSE)", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("refuse une requête sans token (401)", async () => {
    const controller = new AbortController()
    const response = await GET(eventsRequest(null, controller))
    expect(response.status).toBe(401)
    controller.abort()
  })

  it("refuse un token invalide (401)", async () => {
    const controller = new AbortController()
    const response = await GET(eventsRequest("bogus-token", controller))
    expect(response.status).toBe(401)
    controller.abort()
  })

  it("ouvre un flux SSE pour un token valide, avec les en-têtes attendus", async () => {
    const token = signAccessToken({
      userId: "user-1",
      email: "user@example.com",
      firstName: "Jane",
      lastName: "Doe",
      role: "user",
    })
    const controller = new AbortController()

    const response = await GET(eventsRequest(token, controller))

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(response.headers.get("Connection")).toBe("keep-alive")

    // Ferme le flux (et l'intervalle de heartbeat sous-jacent) pour ne pas
    // laisser de timer actif après la fin du test.
    controller.abort()
  })
})
