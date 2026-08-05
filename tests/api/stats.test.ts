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

  // Corrigé ici : avec un filtre de date, le stock des banques à cette date
  // était recalculé avec une requête de mouvements PAR CARTE (N+1). On vérifie
  // à la fois le résultat et qu'un seul appel groupé est fait.
  it("calcule le stock des banques à une date donnée en un seul appel groupé (pas de N+1)", async () => {
    vi.mocked(prisma.bank.findMany).mockResolvedValue([
      {
        id: "b1",
        name: "Amen",
        cards: [
          { id: "c1", quantity: 10, name: "Visa", minThreshold: 50 },
          { id: "c2", quantity: 20, name: "Mastercard", minThreshold: 5 },
        ],
      },
    ] as any)
    // Après la date de calcul : une entrée de 4 sur c1 (à retirer du stock
    // actuel) et une sortie de 3 sur c2 (à réajouter au stock actuel). Cette
    // route fait aussi un appel movement.findMany sans rapport (top des
    // sorties) : on distingue les deux par la forme du "where".
    vi.mocked(prisma.movement.findMany).mockImplementation(async (args: any) => {
      if (args?.where?.cardId?.in) {
        return [
          { cardId: "c1", movementType: "entry", quantity: 4 },
          { cardId: "c2", movementType: "exit", quantity: 3 },
        ] as any
      }
      return [] as any
    })

    const response = await GET(makeRequest("http://localhost/api/stats?dateFrom=2026-01-01"))
    const json = await response.json()

    expect(response.status).toBe(200)
    // c1: 10 - 4 = 6 ; c2: 20 + 3 = 23 ; total banque = 29
    expect(json.data.topBanksWithStock[0]).toMatchObject({ id: "b1", totalStock: 29 })

    // Le point clé du correctif : un seul appel groupé pour toutes les cartes
    // de calcul de stock, jamais un appel par carte.
    const stockCalcCalls = vi
      .mocked(prisma.movement.findMany)
      .mock.calls.filter((c: any) => c[0]?.where?.cardId?.in)
    expect(stockCalcCalls).toHaveLength(1)
    expect(stockCalcCalls[0][0]).toMatchObject({
      where: { cardId: { in: ["c1", "c2"] }, createdAt: { gt: expect.any(Date) } },
    })
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
  })

  // Corrigé ici : sans aucun filtre (ni période, ni banque), la requête
  // chargeait l'intégralité de la table des mouvements en mémoire.
  it("limite implicitement aux 12 derniers mois quand aucun filtre n'est fourni", async () => {
    vi.mocked(prisma.movement.findMany).mockResolvedValue([])

    await calculate(makeRequest("http://localhost/api/statistics/calculate", { body: {} }))

    expect(prisma.movement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: expect.any(Date) } }) }),
    )
  })

  it("n'applique aucune borne implicite quand une banque est fournie sans période", async () => {
    vi.mocked(prisma.movement.findMany).mockResolvedValue([])

    await calculate(makeRequest("http://localhost/api/statistics/calculate", { body: { bankId: "b1" } }))

    expect(prisma.movement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ createdAt: expect.anything() }) }),
    )
  })
})
