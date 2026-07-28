import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    inventory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    inventoryLine: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    bank: { findUnique: vi.fn() },
    location: { findMany: vi.fn() },
    stockLevel: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    card: { update: vi.fn() },
    movement: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/server-events", () => ({ serverEvents: { emit: vi.fn() } }))

const { prisma } = await import("@/lib/db")
const { GET: listInventories, POST: createInventory } = await import("@/app/api/inventories/route")
const { DELETE: deleteInventory } = await import("@/app/api/inventories/[id]/route")
const { POST: completeInventory } = await import("@/app/api/inventories/[id]/complete/route")
const { POST: adjustInventory } = await import("@/app/api/inventories/[id]/adjust/route")

const adminToken = signAccessToken({
  userId: "admin-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Istrator",
  role: "admin",
})
const userToken = signAccessToken({
  userId: "user-1",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
})

function requete(url: string, options: { method?: string; body?: unknown; token?: string | null } = {}) {
  const headers = new Headers({ "content-type": "application/json" })
  const tok = options.token === undefined ? adminToken : options.token
  if (tok) headers.set("authorization", `Bearer ${tok}`)
  return new NextRequest(url, {
    method: options.method || (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

/** Exécute le callback de transaction avec le client mocké, comme Prisma. */
function transactionPassante() {
  vi.mocked(prisma.$transaction).mockImplementation(async (arg: any) =>
    typeof arg === "function" ? arg(prisma) : Promise.all(arg),
  )
}

const banque = { id: "bank-1", name: "Amen Bank", code: "AMEN", address: "Tunis" }

function ligne(over: Partial<any> = {}) {
  return {
    id: "line-1",
    cardId: "card-1",
    locationId: "loc-1",
    expectedQuantity: 100,
    countedQuantity: 100,
    card: { name: "Visa Classique" },
    location: { name: "Coffre Tunis" },
    ...over,
  }
}

describe("POST /api/inventories", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionPassante()
  })

  it("refuse un utilisateur non-admin (403)", async () => {
    const reponse = await createInventory(
      requete("http://localhost/api/inventories", { body: { bankId: "bank-1" }, token: userToken }),
    )
    expect(reponse.status).toBe(403)
  })

  it("refuse si la banque n'a aucun emplacement", async () => {
    vi.mocked(prisma.bank.findUnique).mockResolvedValue(banque as any)
    vi.mocked(prisma.inventory.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.location.findMany).mockResolvedValue([] as any)

    const reponse = await createInventory(
      requete("http://localhost/api/inventories", { body: { bankId: "bank-1" } }),
    )
    expect(reponse.status).toBe(400)
    expect((await reponse.json()).error).toMatch(/aucun emplacement/i)
  })

  // Deux comptages simultanés sur le même périmètre produiraient des
  // régularisations contradictoires.
  it("refuse (409) un second inventaire tant que le précédent est en cours", async () => {
    vi.mocked(prisma.bank.findUnique).mockResolvedValue(banque as any)
    vi.mocked(prisma.inventory.findFirst).mockResolvedValue({ reference: "INV-EN-COURS" } as any)

    const reponse = await createInventory(
      requete("http://localhost/api/inventories", { body: { bankId: "bank-1" } }),
    )
    expect(reponse.status).toBe(409)
    expect((await reponse.json()).error).toContain("INV-EN-COURS")
    expect(prisma.inventory.create).not.toHaveBeenCalled()
  })

  // expectedQuantity doit être une photo du stock au lancement : si on le
  // relisait à la clôture, les mouvements survenus entretemps masqueraient
  // les écarts réels.
  it("fige le stock théorique de chaque couple (carte, emplacement) à l'ouverture", async () => {
    vi.mocked(prisma.bank.findUnique).mockResolvedValue(banque as any)
    vi.mocked(prisma.inventory.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.location.findMany).mockResolvedValue([{ id: "loc-1" }, { id: "loc-2" }] as any)
    vi.mocked(prisma.stockLevel.findMany).mockResolvedValue([
      { cardId: "card-1", locationId: "loc-1", quantity: 271 },
      { cardId: "card-1", locationId: "loc-2", quantity: 100 },
    ] as any)
    vi.mocked(prisma.inventory.create).mockResolvedValue({
      id: "inv-1",
      reference: "INV-X",
      lines: [
        { expectedQuantity: 271, countedQuantity: null },
        { expectedQuantity: 100, countedQuantity: null },
      ],
    } as any)

    const reponse = await createInventory(
      requete("http://localhost/api/inventories", { body: { bankId: "bank-1" } }),
    )
    expect(reponse.status).toBe(201)

    const lignesCreees = vi.mocked(prisma.inventory.create).mock.calls[0][0].data.lines!.create
    expect(lignesCreees).toEqual([
      { cardId: "card-1", locationId: "loc-1", expectedQuantity: 271 },
      { cardId: "card-1", locationId: "loc-2", expectedQuantity: 100 },
    ])

    const json = await reponse.json()
    expect(json.data.totalLines).toBe(2)
    expect(json.data.countedLines).toBe(0)
    expect(json.data.totalExpected).toBe(371)
  })
})

describe("POST /api/inventories/[id]/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionPassante()
  })

  // Sans ce garde-fou on ne saurait pas distinguer « compté à 0 » de
  // « pas encore compté », et le rapport serait faux.
  it("refuse la clôture tant que des lignes ne sont pas comptées", async () => {
    vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
      id: "inv-1",
      status: "in_progress",
      reference: "INV-X",
      bank: { name: "Amen Bank" },
      lines: [ligne(), ligne({ id: "line-2", countedQuantity: null })],
    } as any)

    const reponse = await completeInventory(requete("http://localhost/x", { method: "POST" }), {
      params: { id: "inv-1" },
    })
    expect(reponse.status).toBe(400)
    expect((await reponse.json()).error).toMatch(/n'ont pas encore été comptées/i)
    expect(prisma.inventory.update).not.toHaveBeenCalled()
  })

  it("clôture et compte les écarts, sans toucher au stock", async () => {
    vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
      id: "inv-1",
      status: "in_progress",
      reference: "INV-X",
      bank: { name: "Amen Bank" },
      lines: [ligne(), ligne({ id: "line-2", expectedQuantity: 50, countedQuantity: 45 })],
    } as any)
    vi.mocked(prisma.inventory.update).mockResolvedValue({ id: "inv-1", status: "completed" } as any)

    const reponse = await completeInventory(requete("http://localhost/x", { method: "POST" }), {
      params: { id: "inv-1" },
    })
    const json = await reponse.json()

    expect(reponse.status).toBe(200)
    expect(json.message).toContain("1 écart")
    expect(prisma.stockLevel.update).not.toHaveBeenCalled()
    expect(prisma.movement.create).not.toHaveBeenCalled()
  })
})

describe("POST /api/inventories/[id]/adjust", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionPassante()
    vi.mocked(prisma.stockLevel.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any)
    vi.mocked(prisma.inventory.update).mockResolvedValue({} as any)
  })

  it("refuse un utilisateur non-admin (403)", async () => {
    const reponse = await adjustInventory(requete("http://localhost/x", { method: "POST", token: userToken }), {
      params: { id: "inv-1" },
    })
    expect(reponse.status).toBe(403)
  })

  it("refuse de régulariser un inventaire non clôturé (409)", async () => {
    vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
      id: "inv-1",
      status: "in_progress",
      reference: "INV-X",
      bank: { name: "Amen Bank" },
      lines: [ligne()],
    } as any)

    const reponse = await adjustInventory(requete("http://localhost/x", { method: "POST" }), {
      params: { id: "inv-1" },
    })
    expect(reponse.status).toBe(409)
    expect(prisma.stockLevel.update).not.toHaveBeenCalled()
  })

  // Un excédent est une entrée à l'emplacement, un manquant une sortie :
  // c'est ce qui rend la correction lisible dans l'historique.
  it("aligne le stock sur le comptage et trace chaque correction", async () => {
    vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
      id: "inv-1",
      status: "completed",
      reference: "INV-2026-AMEN",
      bank: { name: "Amen Bank" },
      lines: [
        ligne({ id: "l1", cardId: "card-1", locationId: "loc-1", expectedQuantity: 100, countedQuantity: 97 }),
        ligne({ id: "l2", cardId: "card-2", locationId: "loc-2", expectedQuantity: 40, countedQuantity: 46 }),
        ligne({ id: "l3", cardId: "card-3", locationId: "loc-1", expectedQuantity: 10, countedQuantity: 10 }),
      ],
    } as any)
    // Stock réellement en base au moment de la régularisation. Il diffère
    // volontairement du théorique figé pour card-1 (100 -> 105) : un mouvement
    // a eu lieu pendant le comptage.
    const stockActuel: Record<string, number> = { "card-1|loc-1": 105, "card-2|loc-2": 40 }
    vi.mocked(prisma.stockLevel.findFirst).mockImplementation(
      async ({ where }: any) =>
        ({
          id: `sl-${where.cardId}-${where.locationId}`,
          quantity: stockActuel[`${where.cardId}|${where.locationId}`] ?? 0,
        }) as any,
    )
    vi.mocked(prisma.stockLevel.aggregate).mockResolvedValue({ _sum: { quantity: 123 } } as any)

    const reponse = await adjustInventory(requete("http://localhost/x", { method: "POST" }), {
      params: { id: "inv-1" },
    })
    const json = await reponse.json()
    expect(reponse.status).toBe(200)
    expect(json.message).toContain("2 correction")

    // Le stock devient exactement la quantité comptée, pas un delta appliqué.
    const ecrits = vi.mocked(prisma.stockLevel.update).mock.calls.map((c: any) => [c[0].where.id, c[0].data.quantity])
    expect(ecrits).toEqual([
      ["sl-card-1-loc-1", 97],
      ["sl-card-2-loc-2", 46],
    ])

    // La ligne sans écart ne génère aucune écriture.
    expect(prisma.movement.create).toHaveBeenCalledTimes(2)
    const mouvements = vi.mocked(prisma.movement.create).mock.calls.map((c: any) => c[0].data)
    // Le stock passe de 105 (réel) à 97 (compté) : le mouvement doit valoir 8,
    // pas 3 (l'écart d'inventaire), sinon l'historique n'explique plus le stock.
    expect(mouvements[0]).toMatchObject({
      cardId: "card-1",
      movementType: "exit",
      fromLocationId: "loc-1",
      toLocationId: null,
      quantity: 8,
      reason: "Régularisation inventaire INV-2026-AMEN",
    })
    expect(mouvements[1]).toMatchObject({
      cardId: "card-2",
      movementType: "entry",
      fromLocationId: null,
      toLocationId: "loc-2",
      quantity: 6,
    })

    // card.quantity est resynchronisé pour chaque carte touchée, comme ailleurs.
    expect(prisma.card.update).toHaveBeenCalledTimes(2)
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityType: "inventory", entityName: "INV-2026-AMEN" }),
      }),
    )
  })

  it("ne crée aucun mouvement quand le comptage est conforme", async () => {
    vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
      id: "inv-1",
      status: "completed",
      reference: "INV-X",
      bank: { name: "Amen Bank" },
      lines: [ligne({ expectedQuantity: 100, countedQuantity: 100 })],
    } as any)

    const reponse = await adjustInventory(requete("http://localhost/x", { method: "POST" }), {
      params: { id: "inv-1" },
    })
    const json = await reponse.json()

    expect(reponse.status).toBe(200)
    expect(json.message).toMatch(/déjà conforme/i)
    expect(prisma.movement.create).not.toHaveBeenCalled()
    expect(prisma.stockLevel.update).not.toHaveBeenCalled()
  })

  it("refuse (409) de régulariser deux fois le même inventaire", async () => {
    vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
      id: "inv-1",
      status: "adjusted",
      reference: "INV-X",
      bank: { name: "Amen Bank" },
      lines: [ligne()],
    } as any)

    const reponse = await adjustInventory(requete("http://localhost/x", { method: "POST" }), {
      params: { id: "inv-1" },
    })
    expect(reponse.status).toBe(409)
    expect(prisma.movement.create).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/inventories/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  // Supprimer un inventaire régularisé effacerait la justification de
  // mouvements de stock bien réels.
  it("refuse (409) de supprimer un inventaire ayant servi à régulariser", async () => {
    vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
      id: "inv-1",
      status: "adjusted",
      reference: "INV-X",
      bank: { name: "Amen Bank" },
    } as any)

    const reponse = await deleteInventory(requete("http://localhost/x", { method: "DELETE" }), {
      params: { id: "inv-1" },
    })
    expect(reponse.status).toBe(409)
    expect(prisma.inventory.delete).not.toHaveBeenCalled()
  })

  it("supprime un inventaire en cours et journalise l'action", async () => {
    vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
      id: "inv-1",
      status: "in_progress",
      reference: "INV-X",
      bank: { name: "Amen Bank" },
    } as any)

    const reponse = await deleteInventory(requete("http://localhost/x", { method: "DELETE" }), {
      params: { id: "inv-1" },
    })
    expect(reponse.status).toBe(200)
    expect(prisma.inventory.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } })
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })
})

describe("GET /api/inventories", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const reponse = await listInventories(requete("http://localhost/api/inventories", { token: null }))
    expect(reponse.status).toBe(401)
  })

  it("résume l'avancement sans renvoyer les lignes", async () => {
    vi.mocked(prisma.inventory.findMany).mockResolvedValue([
      {
        id: "inv-1",
        reference: "INV-X",
        lines: [
          { expectedQuantity: 100, countedQuantity: 97 },
          { expectedQuantity: 40, countedQuantity: 40 },
          { expectedQuantity: 10, countedQuantity: null },
        ],
      },
    ] as any)

    const reponse = await listInventories(requete("http://localhost/api/inventories"))
    const json = await reponse.json()

    expect(json.data[0]).toMatchObject({
      totalLines: 3,
      countedLines: 2,
      discrepancyLines: 1,
      totalExpected: 150,
      totalCounted: 137,
    })
    expect(json.data[0].lines).toBeUndefined()
  })
})
