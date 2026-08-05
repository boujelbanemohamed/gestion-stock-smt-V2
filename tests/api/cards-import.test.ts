import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    card: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bank: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { POST: importCards } = await import("@/app/api/cards/import/route")

const adminToken = signAccessToken({
  userId: "admin-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "System",
  role: "admin",
})

const nonAdminToken = signAccessToken({
  userId: "user-2",
  email: "operator@example.com",
  firstName: "Sam",
  lastName: "Operator",
  role: "user",
})

function makeRequest(url: string, options: { body?: unknown; token?: string | null } = {}) {
  const headers = new Headers({ "content-type": "application/json" })
  const tok = options.token === undefined ? adminToken : options.token
  if (tok) headers.set("authorization", `Bearer ${tok}`)
  return new NextRequest(url, { method: "POST", headers, body: JSON.stringify(options.body ?? { data: [] }) })
}

describe("POST /api/cards/import", () => {
  // Corrigé ici : l'import en masse n'était réservé à personne (requireAuth
  // seul), permettant à n'importe quel utilisateur connecté de créer ou
  // d'écraser des cartes en masse (y compris en retargetant leur banque).
  it("refuse une requête non authentifiée (401)", async () => {
    const response = await importCards(makeRequest("http://localhost/api/cards/import", { token: null }))
    expect(response.status).toBe(401)
  })

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await importCards(
      makeRequest("http://localhost/api/cards/import", { token: nonAdminToken }),
    )
    expect(response.status).toBe(403)
    expect(prisma.card.create).not.toHaveBeenCalled()
  })
})
