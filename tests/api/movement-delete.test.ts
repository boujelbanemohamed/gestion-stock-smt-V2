import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    movement: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    stockLevel: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    card: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/server-events", () => ({
  serverEvents: { emit: vi.fn() },
}))

const { prisma } = await import("@/lib/db")
const { DELETE: deleteMovement } = await import("@/app/api/movements/[id]/route")

const adminToken = signAccessToken({
  userId: "admin-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Istrator",
  role: "admin",
})

function deleteRequest(token: string) {
  const headers = new Headers({ authorization: `Bearer ${token}` })
  return new NextRequest("http://localhost/api/movements/mv-1", { method: "DELETE", headers })
}

// Exécute le callback de transaction avec le client mocké, comme le ferait Prisma.
function transactionPassante() {
  vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma))
}

/** Stock actuellement enregistré à un emplacement donné. */
function stockExistant(locationId: string, quantity: number) {
  vi.mocked(prisma.stockLevel.findFirst).mockImplementation(async ({ where }: any) =>
    where.locationId === locationId ? ({ id: `sl-${locationId}`, quantity } as any) : null,
  )
}

/** Dernière quantité écrite pour un emplacement (via update ou create). */
function quantiteEcrite(locationId: string): number | undefined {
  const update = vi
    .mocked(prisma.stockLevel.update)
    .mock.calls.find((c: any) => c[0]?.where?.id === `sl-${locationId}`)
  if (update) return (update[0] as any).data.quantity
  const create = vi
    .mocked(prisma.stockLevel.create)
    .mock.calls.find((c: any) => c[0]?.data?.locationId === locationId)
  return create ? (create[0] as any).data.quantity : undefined
}

describe("DELETE /api/movements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionPassante()
    vi.mocked(prisma.stockLevel.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any)
    vi.mocked(prisma.movement.delete).mockResolvedValue({} as any)
  })

  it("supprime le mouvement et journalise l'action avec le détail de la carte", async () => {
    vi.mocked(prisma.movement.findUnique).mockResolvedValue({
      id: "mv-1",
      cardId: "card-1",
      movementType: "exit",
      quantity: 10,
      fromLocationId: "loc-1",
      toLocationId: null,
      card: { id: "card-1", name: "Visa Classique" },
    } as any)
    stockExistant("loc-1", 40)

    const response = await deleteMovement(deleteRequest(adminToken), { params: { id: "mv-1" } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.movement.delete).toHaveBeenCalledWith({ where: { id: "mv-1" } })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "admin-1",
          action: "delete",
          entityType: "movement",
          entityName: "Sortie - Visa Classique",
        }),
      }),
    )
  })

  // Le stock doit être remis dans l'état où il était avant le mouvement :
  // c'est précisément ce que la suppression ne faisait pas.
  it("annule une ENTRÉE en retirant la quantité de l'emplacement de destination", async () => {
    vi.mocked(prisma.movement.findUnique).mockResolvedValue({
      id: "mv-1",
      cardId: "card-1",
      movementType: "entry",
      quantity: 23,
      fromLocationId: null,
      toLocationId: "loc-1",
      card: { id: "card-1", name: "Visa Classique" },
    } as any)
    stockExistant("loc-1", 100)

    const response = await deleteMovement(deleteRequest(adminToken), { params: { id: "mv-1" } })

    expect(response.status).toBe(200)
    expect(quantiteEcrite("loc-1")).toBe(77)
  })

  it("annule une SORTIE en rendant la quantité à l'emplacement source", async () => {
    vi.mocked(prisma.movement.findUnique).mockResolvedValue({
      id: "mv-1",
      cardId: "card-1",
      movementType: "exit",
      quantity: 15,
      fromLocationId: "loc-1",
      toLocationId: null,
      card: { id: "card-1", name: "Visa Classique" },
    } as any)
    stockExistant("loc-1", 60)

    const response = await deleteMovement(deleteRequest(adminToken), { params: { id: "mv-1" } })

    expect(response.status).toBe(200)
    expect(quantiteEcrite("loc-1")).toBe(75)
  })

  it("annule un TRANSFERT dans les deux emplacements", async () => {
    vi.mocked(prisma.movement.findUnique).mockResolvedValue({
      id: "mv-1",
      cardId: "card-1",
      movementType: "transfer",
      quantity: 10,
      fromLocationId: "loc-1",
      toLocationId: "loc-2",
      card: { id: "card-1", name: "Visa Classique" },
    } as any)
    vi.mocked(prisma.stockLevel.findFirst).mockImplementation(async ({ where }: any) => {
      if (where.locationId === "loc-1") return { id: "sl-loc-1", quantity: 30 } as any
      if (where.locationId === "loc-2") return { id: "sl-loc-2", quantity: 50 } as any
      return null
    })

    const response = await deleteMovement(deleteRequest(adminToken), { params: { id: "mv-1" } })

    expect(response.status).toBe(200)
    expect(quantiteEcrite("loc-1"), "la source récupère les cartes").toBe(40)
    expect(quantiteEcrite("loc-2"), "la destination les restitue").toBe(40)
  })

  it("resynchronise le total de la carte après annulation", async () => {
    vi.mocked(prisma.movement.findUnique).mockResolvedValue({
      id: "mv-1",
      cardId: "card-1",
      movementType: "entry",
      quantity: 5,
      fromLocationId: null,
      toLocationId: "loc-1",
      card: { id: "card-1", name: "Visa Classique" },
    } as any)
    stockExistant("loc-1", 12)
    vi.mocked(prisma.stockLevel.aggregate).mockResolvedValue({ _sum: { quantity: 7 } } as any)

    await deleteMovement(deleteRequest(adminToken), { params: { id: "mv-1" } })

    expect(prisma.card.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { quantity: 7 },
    })
  })

  // Sans ce garde-fou, supprimer une entrée dont les cartes sont déjà reparties
  // creuserait un stock négatif.
  it("refuse (409) si l'annulation rendrait le stock négatif, sans rien supprimer", async () => {
    vi.mocked(prisma.movement.findUnique).mockResolvedValue({
      id: "mv-1",
      cardId: "card-1",
      movementType: "entry",
      quantity: 100,
      fromLocationId: null,
      toLocationId: "loc-1",
      card: { id: "card-1", name: "Visa Classique" },
    } as any)
    stockExistant("loc-1", 30)
    // Une vraie transaction annule tout en cas d'exception : on le simule ici.
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      try {
        return await cb(prisma)
      } catch (e) {
        vi.mocked(prisma.movement.delete).mockClear()
        throw e
      }
    })

    const response = await deleteMovement(deleteRequest(adminToken), { params: { id: "mv-1" } })
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/stock négatif/i)
    expect(prisma.movement.delete).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it("renvoie 404 sans rien journaliser si le mouvement n'existe pas", async () => {
    vi.mocked(prisma.movement.findUnique).mockResolvedValue(null)

    const response = await deleteMovement(deleteRequest(adminToken), { params: { id: "mv-404" } })
    expect(response.status).toBe(404)
    expect(prisma.movement.delete).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })
})
