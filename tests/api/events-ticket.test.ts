import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken, verifyRealtimeTicket } from "@/lib/auth"

const { POST } = await import("@/app/api/events/ticket/route")

const userPayload = {
  userId: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
}

function ticketRequest(token?: string) {
  const headers = new Headers()
  if (token) headers.set("authorization", `Bearer ${token}`)
  return new NextRequest("http://localhost/api/events/ticket", { method: "POST", headers })
}

describe("POST /api/events/ticket", () => {
  it("refuse une requête non authentifiée (401)", async () => {
    const response = await POST(ticketRequest())
    expect(response.status).toBe(401)
  })

  it("émet un ticket temps réel valide pour l'utilisateur authentifié", async () => {
    const token = signAccessToken(userPayload)
    const response = await POST(ticketRequest(token))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(verifyRealtimeTicket(json.data.ticket).userId).toBe(userPayload.userId)
  })

  // Le ticket n'est pas le token d'accès recopié : c'est un jeton distinct,
  // avec sa propre audience et sa propre (très courte) durée de vie.
  it("ne renvoie jamais le token d'accès lui-même comme ticket", async () => {
    const token = signAccessToken(userPayload)
    const response = await POST(ticketRequest(token))
    const json = await response.json()

    expect(json.data.ticket).not.toBe(token)
  })
})
