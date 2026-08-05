import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    card: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bank: {
      findMany: vi.fn(),
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

const bankAmen = { id: "bank-1", code: "AMEN", name: "Amen Bank" }

describe("POST /api/cards/import", () => {
  beforeEach(() => vi.clearAllMocks())

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

  it("refuse un format de données invalide (400)", async () => {
    const response = await importCards(makeRequest("http://localhost/api/cards/import", { body: { data: "x" } }))
    expect(response.status).toBe(400)
  })

  // Corrigé ici : la résolution de banque/carte se faisait avant par 2-6
  // requêtes séquentielles PAR LIGNE (N+1). On vérifie qu'un seul findMany
  // est fait sur chaque table, quel que soit le nombre de lignes importées.
  it("résout la banque par code, sans requête supplémentaire par ligne", async () => {
    vi.mocked(prisma.bank.findMany).mockResolvedValue([bankAmen] as any)
    vi.mocked(prisma.card.findMany).mockResolvedValue([])
    vi.mocked(prisma.card.create).mockImplementation(async ({ data }: any) => ({ id: "card-new", ...data }) as any)

    const response = await importCards(
      makeRequest("http://localhost/api/cards/import", {
        body: {
          data: [
            { BanqueEmettrice: "AMEN", NomCarte: "Visa Classique", Type: "Débit", SousType: "Visa", SousSousType: "National" },
            { BanqueEmettrice: "AMEN", NomCarte: "Mastercard Gold", Type: "Crédit", SousType: "Mastercard", SousSousType: "International" },
          ],
        },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.created).toBe(2)
    expect(json.rejected).toBe(0)
    // Une seule lecture de chaque table, peu importe le nombre de lignes.
    expect(prisma.bank.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.card.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.card.create).toHaveBeenCalledTimes(2)
  })

  it("rejette une ligne dont la banque est introuvable, sans bloquer les autres lignes", async () => {
    vi.mocked(prisma.bank.findMany).mockResolvedValue([bankAmen] as any)
    vi.mocked(prisma.card.findMany).mockResolvedValue([])
    vi.mocked(prisma.card.create).mockImplementation(async ({ data }: any) => ({ id: "card-new", ...data }) as any)

    const response = await importCards(
      makeRequest("http://localhost/api/cards/import", {
        body: {
          data: [
            { BanqueEmettrice: "INCONNUE", NomCarte: "Visa", Type: "Débit", SousType: "Visa", SousSousType: "National" },
            { BanqueEmettrice: "AMEN", NomCarte: "Mastercard", Type: "Crédit", SousType: "Mastercard", SousSousType: "International" },
          ],
        },
      }),
    )
    const json = await response.json()

    expect(json.created).toBe(1)
    expect(json.rejected).toBe(0)
    expect(json.errors).toHaveLength(1)
    expect(json.errors[0]).toContain("INCONNUE")
  })

  // Le point délicat de la réécriture : deux lignes identiques dans le MÊME
  // fichier doivent se comporter comme avant (la 2e met à jour la carte que
  // la 1re vient de créer), même si la lecture initiale des cartes date
  // d'avant le début de la boucle.
  it("traite la deuxième occurrence d'un doublon intra-fichier comme une mise à jour", async () => {
    vi.mocked(prisma.bank.findMany).mockResolvedValue([bankAmen] as any)
    vi.mocked(prisma.card.findMany).mockResolvedValue([])
    vi.mocked(prisma.card.create).mockResolvedValue({
      id: "card-new",
      bankId: "bank-1",
      name: "Visa Classique",
      type: "Débit",
      subType: "Visa",
      subSubType: "National",
    } as any)
    vi.mocked(prisma.card.update).mockResolvedValue({} as any)

    const row = { BanqueEmettrice: "AMEN", NomCarte: "Visa Classique", Type: "Débit", SousType: "Visa", SousSousType: "National" }
    const response = await importCards(
      makeRequest("http://localhost/api/cards/import", { body: { data: [row, row] } }),
    )
    const json = await response.json()

    expect(json.created).toBe(1)
    expect(json.updated).toBe(1)
    expect(prisma.card.create).toHaveBeenCalledTimes(1)
    expect(prisma.card.update).toHaveBeenCalledTimes(1)
    expect(prisma.card.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "card-new" } }),
    )
  })
})
