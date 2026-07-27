import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    bank: { findMany: vi.fn() },
    card: { findMany: vi.fn() },
    location: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { GET } = await import("@/app/api/search/route")

const token = signAccessToken({
  userId: "user-1",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
})

function makeRequest(url: string, token2?: string | null) {
  const headers = new Headers()
  const tok = token2 === undefined ? token : token2
  if (tok) headers.set("authorization", `Bearer ${tok}`)
  return new NextRequest(url, { headers })
}

describe("GET /api/search", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/search?q=amen", null))
    expect(response.status).toBe(401)
  })

  it("renvoie des résultats vides sans appeler la base si la requête est trop courte", async () => {
    const response = await GET(makeRequest("http://localhost/api/search?q=a"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual({ banks: [], cards: [], locations: [], users: [] })
    expect(prisma.bank.findMany).not.toHaveBeenCalled()
  })

  it("recherche en parallèle dans banques, cartes, emplacements et utilisateurs", async () => {
    vi.mocked(prisma.bank.findMany).mockResolvedValue([{ id: "b1", name: "Amen Bank", code: "AMEN" }] as any)
    vi.mocked(prisma.card.findMany).mockResolvedValue([])
    vi.mocked(prisma.location.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.findMany).mockResolvedValue([])

    const response = await GET(makeRequest("http://localhost/api/search?q=amen"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.banks).toEqual([{ id: "b1", name: "Amen Bank", code: "AMEN" }])
    expect(json.data.cards).toEqual([])
  })
})
