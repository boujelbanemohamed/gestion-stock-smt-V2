import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    bank: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    card: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    location: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    movement: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { GET } = await import("@/app/api/stats/route")
const { POST: calculate } = await import("@/app/api/statistics/calculate/route")

const token = signAccessToken({
  userId: "user-1",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
})

function makeRequest(url: string, options: { method?: string; body?: unknown; token?: string | null } = {}) {
  const headers = new Headers({ "content-type": "application/json" })
  const tok = options.token === undefined ? token : options.token
  if (tok) headers.set("authorization", `Bearer ${tok}`)
  return new NextRequest(url, {
    method: options.method || (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

function setupHappyPathMocks() {
  vi.mocked(prisma.bank.count).mockResolvedValue(3)
  vi.mocked(prisma.card.count).mockResolvedValue(5)
  vi.mocked(prisma.location.count).mockResolvedValue(4)
  vi.mocked(prisma.movement.count).mockResolvedValue(2)
  vi.mocked(prisma.card.aggregate).mockResolvedValue({ _sum: { quantity: 1000 } } as any)
  vi.mocked(prisma.card.findMany).mockResolvedValue([
    { id: "c1", name: "Visa", quantity: 10, minThreshold: 50, bank: { id: "b1", name: "Amen" } },
  ] as any)
  vi.mocked(prisma.user.count).mockResolvedValue(7)
  vi.mocked(prisma.movement.findMany).mockResolvedValue([])
  vi.mocked(prisma.bank.findMany).mockResolvedValue([
    { id: "b1", name: "Amen", cards: [{ quantity: 10 }] },
  ] as any)
}

describe("GET /api/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupHappyPathMocks()
  })

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/stats", { token: null }))
    expect(response.status).toBe(401)
  })

  it("retourne les statistiques agrégées, avec la liste des cartes en stock bas", async () => {
    const response = await GET(makeRequest("http://localhost/api/stats"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.totalBanks).toBe(3)
    expect(json.data.activeUsers).toBe(7)
    expect(json.data.lowStockCards).toBe(1)
    expect(json.data.lowStockCardsList[0]).toMatchObject({ id: "c1", quantity: 10, minThreshold: 50 })
  })
})

describe("POST /api/statistics/calculate", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await calculate(makeRequest("http://localhost/api/statistics/calculate", { token: null, body: {} }))
    expect(response.status).toBe(401)
  })

  it("calcule le pourcentage De/Vers à partir des mouvements filtrés", async () => {
    vi.mocked(prisma.movement.findMany).mockResolvedValue([
      {
        id: "m1",
        movementType: "transfer",
        quantity: 30,
        toLocationId: "loc-vers",
        fromLocationId: "loc-de",
        createdAt: new Date(),
        card: { type: "Visa", bank: { id: "b1", name: "Amen", code: "AMEN" } },
      },
      {
        id: "m2",
        movementType: "transfer",
        quantity: 10,
        toLocationId: "loc-de",
        fromLocationId: "loc-other",
        createdAt: new Date(),
        card: { type: "Visa", bank: { id: "b1", name: "Amen", code: "AMEN" } },
      },
    ] as any)
    vi.mocked(prisma.location.findUnique).mockResolvedValue({ name: "Emplacement" } as any)

    const response = await calculate(
      makeRequest("http://localhost/api/statistics/calculate", {
        body: { fromLocationId: "loc-de", toLocationId: "loc-vers" },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.quantiteDe).toBe(10)
    expect(json.data.quantiteVers).toBe(30)
    expect(json.data.total).toBe(40)
    expect(json.data.pourcentage).toBeCloseTo(75, 5)
  })
})
