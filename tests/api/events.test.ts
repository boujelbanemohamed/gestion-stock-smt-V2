import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken, signRealtimeTicket } from "@/lib/auth"

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { GET } = await import("@/app/api/events/route")

function eventsRequest(ticket: string | null, controller: AbortController) {
  const url = ticket ? `http://localhost/api/events?ticket=${encodeURIComponent(ticket)}` : "http://localhost/api/events"
  return new NextRequest(url, { signal: controller.signal })
}

describe("GET /api/events (SSE)", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("refuse une requête sans ticket (401)", async () => {
    const controller = new AbortController()
    const response = await GET(eventsRequest(null, controller))
    expect(response.status).toBe(401)
    controller.abort()
  })

  it("refuse un ticket invalide (401)", async () => {
    const controller = new AbortController()
    const response = await GET(eventsRequest("bogus-ticket", controller))
    expect(response.status).toBe(401)
    controller.abort()
  })

  // Un vrai token d'accès n'a plus cours ici : seul un ticket de
  // /api/events/ticket (audience distincte) est accepté — sinon un token
  // d'accès complet (15 minutes) finirait dans les journaux d'accès et les
  // outils de supervision qui capturent l'URL des requêtes.
  it("refuse un token d'accès classique, même valide (mauvaise audience)", async () => {
    const accessToken = signAccessToken({
      userId: "user-1",
      email: "user@example.com",
      firstName: "Jane",
      lastName: "Doe",
      role: "user",
    })
    const controller = new AbortController()
    const response = await GET(eventsRequest(accessToken, controller))
    expect(response.status).toBe(401)
    controller.abort()
  })

  it("ouvre un flux SSE pour un ticket valide, avec les en-têtes attendus", async () => {
    const ticket = signRealtimeTicket("user-1")
    const controller = new AbortController()

    const response = await GET(eventsRequest(ticket, controller))

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(response.headers.get("Connection")).toBe("keep-alive")

    // Ferme le flux (et l'intervalle de heartbeat sous-jacent) pour ne pas
    // laisser de timer actif après la fin du test.
    controller.abort()
  })
})
