import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    card: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    stockLevel: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    bank: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { GET, POST } = await import("@/app/api/cards/route")
const { GET: getById, PUT: updateById, DELETE: deleteById } = await import("@/app/api/cards/[id]/route")
const { POST: importCards } = await import("@/app/api/cards/import/route")

const token = signAccessToken({
  userId: "user-1",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "admin",
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

const card = {
  id: "card-1",
  name: "Visa Classique",
  type: "Carte débit",
  subType: "Visa",
  subSubType: "National",
  bankId: "bank-1",
  quantity: 100,
  minThreshold: 50,
  maxThreshold: 1000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  stockLevels: [],
}

describe("GET /api/cards", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/cards", { token: null }))
    expect(response.status).toBe(401)
  })

  it("retourne les cartes avec la quantité recalculée depuis les stockLevels", async () => {
    vi.mocked(prisma.card.findMany).mockResolvedValue([
      { ...card, quantity: 999, stockLevels: [{ quantity: 10 }, { quantity: 20 }] },
    ] as any)

    const response = await GET(makeRequest("http://localhost/api/cards"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data[0].quantity).toBe(30)
  })

  it("ne filtre pas par isActive quand status=all", async () => {
    vi.mocked(prisma.card.findMany).mockResolvedValue([card] as any)

    await GET(makeRequest("http://localhost/api/cards?status=all"))

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ isActive: expect.anything() }) }),
    )
  })

  it("filtre isActive:false quand status=inactive", async () => {
    vi.mocked(prisma.card.findMany).mockResolvedValue([{ ...card, isActive: false }] as any)

    await GET(makeRequest("http://localhost/api/cards?status=inactive"))

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: false }) }),
    )
  })

  it("filtre les cartes en stock faible quand lowStock=true", async () => {
    vi.mocked(prisma.card.findMany).mockResolvedValue([
      { ...card, id: "low", minThreshold: 50, stockLevels: [{ quantity: 5 }] },
      { ...card, id: "ok", minThreshold: 50, stockLevels: [{ quantity: 500 }] },
    ] as any)

    const response = await GET(makeRequest("http://localhost/api/cards?lowStock=true"))
    const json = await response.json()

    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe("low")
  })
})

describe("POST /api/cards", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse si des champs requis manquent (400)", async () => {
    const response = await POST(makeRequest("http://localhost/api/cards", { body: { name: "Test" } }))
    expect(response.status).toBe(400)
  })

  it("refuse si le seuil minimum >= seuil maximum (400)", async () => {
    const response = await POST(
      makeRequest("http://localhost/api/cards", {
        body: {
          name: "Test",
          type: "Carte débit",
          subType: "Visa",
          subSubType: "National",
          bankId: "bank-1",
          minThreshold: 100,
          maxThreshold: 50,
        },
      }),
    )
    expect(response.status).toBe(400)
    expect(prisma.card.create).not.toHaveBeenCalled()
  })

  it("crée une carte valide et journalise l'action", async () => {
    vi.mocked(prisma.card.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.card.create).mockResolvedValue(card as any)

    const response = await POST(
      makeRequest("http://localhost/api/cards", {
        body: { name: "Visa Classique", type: "Carte débit", subType: "Visa", subSubType: "National", bankId: "bank-1" },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data.name).toBe("Visa Classique")
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "create", module: "cards" }) }),
    )
  })

  // Corrigé ici : cette combinaison est désormais protégée par une contrainte
  // d'unicité en base (bankId+name+type+subType+subSubType), sur laquelle
  // l'import CSV s'appuyait déjà pour dédupliquer, mais que la création à
  // l'unité ne vérifiait pas.
  it("refuse une carte identique à une carte existante (même banque, nom, type, sous-type, sous-sous-type)", async () => {
    vi.mocked(prisma.card.findFirst).mockResolvedValue(card as any)

    const response = await POST(
      makeRequest("http://localhost/api/cards", {
        body: { name: "Visa Classique", type: "Carte débit", subType: "Visa", subSubType: "National", bankId: "bank-1" },
      }),
    )

    expect(response.status).toBe(400)
    expect(prisma.card.create).not.toHaveBeenCalled()
  })
})

describe("GET /api/cards/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie 404 si la carte n'existe pas", async () => {
    vi.mocked(prisma.card.findUnique).mockResolvedValue(null)
    const response = await getById(makeRequest("http://localhost/api/cards/x"), { params: { id: "x" } })
    expect(response.status).toBe(404)
  })
})

describe("PUT /api/cards/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("met à jour une carte et journalise l'action", async () => {
    vi.mocked(prisma.card.update).mockResolvedValue({ ...card, name: "Visa Gold" } as any)
    const response = await updateById(
      makeRequest("http://localhost/api/cards/card-1", { method: "PUT", body: { name: "Visa Gold" } }),
      { params: { id: "card-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.name).toBe("Visa Gold")
  })

  it("refuse de désactiver une carte qui a encore du stock (400)", async () => {
    vi.mocked(prisma.stockLevel.findMany).mockResolvedValue([{ quantity: 7 }] as any)

    const response = await updateById(
      makeRequest("http://localhost/api/cards/card-1", { method: "PUT", body: { isActive: false } }),
      { params: { id: "card-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toContain("7 unité")
    expect(prisma.card.update).not.toHaveBeenCalled()
  })

  it("désactive une carte sans stock", async () => {
    vi.mocked(prisma.stockLevel.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.card.update).mockResolvedValue({ ...card, isActive: false } as any)

    const response = await updateById(
      makeRequest("http://localhost/api/cards/card-1", { method: "PUT", body: { isActive: false } }),
      { params: { id: "card-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.isActive).toBe(false)
  })

  it("réactive une carte sans vérifier le stock", async () => {
    vi.mocked(prisma.card.update).mockResolvedValue({ ...card, isActive: true } as any)

    const response = await updateById(
      makeRequest("http://localhost/api/cards/card-1", { method: "PUT", body: { isActive: true } }),
      { params: { id: "card-1" } },
    )
    expect(response.status).toBe(200)
    expect(prisma.stockLevel.findMany).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/cards/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse la suppression si du stock reste dans des emplacements (400)", async () => {
    vi.mocked(prisma.card.findUnique).mockResolvedValue(card as any)
    vi.mocked(prisma.stockLevel.findMany).mockResolvedValue([{ quantity: 10 }] as any)

    const response = await deleteById(
      makeRequest("http://localhost/api/cards/card-1", { method: "DELETE" }),
      { params: { id: "card-1" } },
    )
    expect(response.status).toBe(400)
    expect(prisma.card.update).not.toHaveBeenCalled()
  })

  it("désactive la carte quand le stock est vide, et journalise l'action", async () => {
    vi.mocked(prisma.card.findUnique).mockResolvedValue(card as any)
    vi.mocked(prisma.stockLevel.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.card.update).mockResolvedValue({ ...card, isActive: false } as any)

    const response = await deleteById(
      makeRequest("http://localhost/api/cards/card-1", { method: "DELETE" }),
      { params: { id: "card-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.card.update).toHaveBeenCalledWith({ where: { id: "card-1" }, data: { isActive: false } })
  })
})

describe("POST /api/cards/import", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un format de données invalide (400)", async () => {
    const response = await importCards(makeRequest("http://localhost/api/cards/import", { body: { data: "x" } }))
    expect(response.status).toBe(400)
  })
})
