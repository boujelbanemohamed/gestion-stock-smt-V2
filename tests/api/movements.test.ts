import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"
import { estReferenceMouvement } from "@/lib/movement-reference"

vi.mock("@/lib/db", () => ({
  prisma: {
    movement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    card: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    stockLevel: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
  sendMovementNotification: vi.fn().mockResolvedValue(undefined),
  sendLowStockAlert: vi.fn().mockResolvedValue(undefined),
}))

const createMovementNotificationMock = vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/notification-helper", () => ({
  createLowStockNotification: vi.fn().mockResolvedValue(undefined),
  createMovementNotification: createMovementNotificationMock,
}))

vi.mock("@/lib/server-events", () => ({
  serverEvents: { emit: vi.fn() },
}))

const { prisma } = await import("@/lib/db")
const { GET, POST } = await import("@/app/api/movements/route")
const { GET: getById, DELETE: deleteById } = await import("@/app/api/movements/[id]/route")

const adminToken = signAccessToken({
  userId: "admin-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "System",
  role: "admin",
})

const userToken = signAccessToken({
  userId: "user-1",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
})

function makeRequest(url: string, options: { method?: string; body?: unknown; token?: string | null } = {}) {
  const headers = new Headers({ "content-type": "application/json" })
  const tok = options.token === undefined ? userToken : options.token
  if (tok) headers.set("authorization", `Bearer ${tok}`)
  return new NextRequest(url, {
    method: options.method || (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

const cardRecord = {
  id: "card-1",
  name: "Visa Classique",
  type: "Carte débit",
  bankId: "bank-1",
  minThreshold: 50,
  maxThreshold: 1000,
}

const userRecord = {
  id: "user-1",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  isActive: true,
}

const movement = {
  id: "mvt-1",
  cardId: "card-1",
  fromLocationId: null,
  toLocationId: "loc-1",
  movementType: "entry",
  quantity: 10,
  reason: "Réapprovisionnement",
  userId: "user-1",
  createdAt: new Date(),
  card: cardRecord,
  user: userRecord,
  fromLocation: null,
  toLocation: { id: "loc-1", name: "Coffre" },
}

describe("GET /api/movements", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/movements", { token: null }))
    expect(response.status).toBe(401)
  })

  it("retourne les mouvements paginés", async () => {
    vi.mocked(prisma.movement.count).mockResolvedValue(1)
    vi.mocked(prisma.movement.findMany).mockResolvedValue([movement] as any)

    const response = await GET(makeRequest("http://localhost/api/movements"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.movements).toHaveLength(1)
    expect(json.data.total).toBe(1)
  })
})

describe("POST /api/movements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma))
  })

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await POST(
      makeRequest("http://localhost/api/movements", {
        token: null,
        body: { cardId: "card-1", movementType: "entry", quantity: 10, reason: "x", toLocationId: "loc-1" },
      }),
    )
    expect(response.status).toBe(401)
  })

  it("refuse si des champs requis manquent (400)", async () => {
    const response = await POST(makeRequest("http://localhost/api/movements", { body: { cardId: "card-1" } }))
    expect(response.status).toBe(400)
  })

  it("refuse si le motif est vide (400)", async () => {
    const response = await POST(
      makeRequest("http://localhost/api/movements", {
        body: { cardId: "card-1", movementType: "entry", quantity: 10, reason: "  ", toLocationId: "loc-1" },
      }),
    )
    expect(response.status).toBe(400)
  })

  // Une simple vérification "falsy" laissait passer les quantités négatives :
  // le mouvement était enregistré tel quel et corrompait le stock.
  it.each([
    ["négative", -5],
    ["nulle", 0],
    ["décimale", 2.5],
    ["non numérique", "abc"],
  ])("refuse une quantité %s (400)", async (_libelle, quantite) => {
    const response = await POST(
      makeRequest("http://localhost/api/movements", {
        body: {
          cardId: "card-1",
          movementType: "entry",
          quantity: quantite,
          reason: "Test",
          toLocationId: "loc-1",
        },
      }),
    )
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.success).toBe(false)
  })

  it("refuse un type de mouvement invalide (400)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(userRecord as any)
    const response = await POST(
      makeRequest("http://localhost/api/movements", {
        body: { cardId: "card-1", movementType: "bogus", quantity: 10, reason: "x" },
      }),
    )
    expect(response.status).toBe(400)
  })

  it("refuse une entrée sans emplacement destination (400)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(userRecord as any)
    const response = await POST(
      makeRequest("http://localhost/api/movements", {
        body: { cardId: "card-1", movementType: "entry", quantity: 10, reason: "x" },
      }),
    )
    expect(response.status).toBe(400)
  })

  it("refuse une sortie si le stock à l'emplacement source est insuffisant", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(userRecord as any)
    vi.mocked(prisma.card.findUnique).mockResolvedValue(cardRecord as any)
    vi.mocked(prisma.stockLevel.findFirst).mockResolvedValue({ quantity: 5 } as any)

    const response = await POST(
      makeRequest("http://localhost/api/movements", {
        body: { cardId: "card-1", movementType: "exit", quantity: 10, reason: "x", fromLocationId: "loc-1" },
      }),
    )
    const json = await response.json()
    expect(response.status).toBe(500)
    expect(json.success).toBe(false)
  })

  it("crée un mouvement d'entrée valide et journalise l'action", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(userRecord as any)
    vi.mocked(prisma.card.findUnique).mockResolvedValue(cardRecord as any).mockResolvedValueOnce(cardRecord as any)
    vi.mocked(prisma.stockLevel.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.stockLevel.aggregate).mockResolvedValue({ _sum: { quantity: 10 } } as any)
    vi.mocked(prisma.card.update).mockResolvedValue(cardRecord as any)
    vi.mocked(prisma.movement.create).mockResolvedValue(movement as any)
    // Deuxième appel dans la vérification des seuils (cardWithStock)
    vi.mocked(prisma.card.findUnique).mockResolvedValue({ ...cardRecord, bank: { name: "Amen" }, stockLevels: [] } as any)

    const response = await POST(
      makeRequest("http://localhost/api/movements", {
        body: { cardId: "card-1", movementType: "entry", quantity: 10, reason: "Réapprovisionnement", toLocationId: "loc-1" },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data.id).toBe("mvt-1")
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "create", module: "movements" }) }),
    )
    expect(createMovementNotificationMock).toHaveBeenCalledWith("entry", "Visa Classique", 10)
  })

  // Le numéro imprimé sur le bordereau est attribué à la création, jamais après.
  it("attribue une référence de bordereau au mouvement créé", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(userRecord as any)
    vi.mocked(prisma.card.findUnique).mockResolvedValue({ ...cardRecord, bank: { name: "Amen" }, stockLevels: [] } as any)
    vi.mocked(prisma.stockLevel.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.stockLevel.aggregate).mockResolvedValue({ _sum: { quantity: 10 } } as any)
    vi.mocked(prisma.card.update).mockResolvedValue(cardRecord as any)
    vi.mocked(prisma.movement.create).mockResolvedValue(movement as any)

    await POST(
      makeRequest("http://localhost/api/movements", {
        body: { cardId: "card-1", movementType: "entry", quantity: 10, reason: "Réapprovisionnement", toLocationId: "loc-1" },
      }),
    )

    const donnees = vi.mocked(prisma.movement.create).mock.calls[0][0].data as { reference?: string }
    expect(donnees.reference).toBeTypeOf("string")
    expect(estReferenceMouvement(donnees.reference!)).toBe(true)
  })
})

describe("GET /api/movements/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie 404 si le mouvement n'existe pas", async () => {
    vi.mocked(prisma.movement.findUnique).mockResolvedValue(null)
    const response = await getById(makeRequest("http://localhost/api/movements/x"), { params: { id: "x" } })
    expect(response.status).toBe(404)
  })
})

describe("DELETE /api/movements/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await deleteById(
      makeRequest("http://localhost/api/movements/mvt-1", { method: "DELETE", token: userToken }),
      { params: { id: "mvt-1" } },
    )
    expect(response.status).toBe(403)
  })

  it("supprime le mouvement pour un admin et journalise l'action", async () => {
    vi.mocked(prisma.movement.findUnique).mockResolvedValue({ ...movement, card: cardRecord } as any)
    vi.mocked(prisma.movement.delete).mockResolvedValue(movement as any)
    // La suppression annule l'effet du mouvement sur le stock : il faut donc
    // un stock suffisant à l'emplacement concerné, sinon l'API refuse (409).
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma))
    vi.mocked(prisma.stockLevel.findFirst).mockResolvedValue({ id: "sl-1", quantity: 50 } as any)
    vi.mocked(prisma.stockLevel.aggregate).mockResolvedValue({ _sum: { quantity: 40 } } as any)

    const response = await deleteById(
      makeRequest("http://localhost/api/movements/mvt-1", { method: "DELETE", token: adminToken }),
      { params: { id: "mvt-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "delete", module: "movements" }) }),
    )
  })
})
