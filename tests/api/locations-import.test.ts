import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    location: {
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
const { POST: importLocations } = await import("@/app/api/locations/import/route")

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

describe("POST /api/locations/import", () => {
  beforeEach(() => vi.clearAllMocks())

  // Corrigé ici : l'import en masse n'était réservé à personne (requireAuth
  // seul), permettant à n'importe quel utilisateur connecté de créer ou
  // d'écraser des emplacements en masse.
  it("refuse une requête non authentifiée (401)", async () => {
    const response = await importLocations(makeRequest("http://localhost/api/locations/import", { token: null }))
    expect(response.status).toBe(401)
  })

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await importLocations(
      makeRequest("http://localhost/api/locations/import", { token: nonAdminToken }),
    )
    expect(response.status).toBe(403)
    expect(prisma.location.create).not.toHaveBeenCalled()
  })

  // Corrigé ici : la résolution de banque/emplacement se faisait avant par
  // une requête PAR LIGNE (N+1). On vérifie qu'une seule lecture de chaque
  // table est faite, quel que soit le nombre de lignes importées.
  it("résout banque et emplacements existants en une seule lecture chacun", async () => {
    vi.mocked(prisma.bank.findMany).mockResolvedValue([bankAmen] as any)
    vi.mocked(prisma.location.findMany).mockResolvedValue([])
    vi.mocked(prisma.location.create).mockImplementation(async ({ data }: any) => ({ id: "loc-new", ...data }) as any)

    const response = await importLocations(
      makeRequest("http://localhost/api/locations/import", {
        body: {
          data: [
            { Banque: "AMEN", NomEmplacement: "Coffre principal" },
            { Banque: "AMEN", NomEmplacement: "Coffre secondaire" },
          ],
        },
      }),
    )
    const json = await response.json()

    expect(json.created).toBe(2)
    expect(prisma.bank.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.location.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.location.create).toHaveBeenCalledTimes(2)
  })

  it("met à jour un emplacement existant (même nom + même banque)", async () => {
    const existing = { id: "loc-1", bankId: "bank-1", name: "Coffre principal", description: "Ancien" }
    vi.mocked(prisma.bank.findMany).mockResolvedValue([bankAmen] as any)
    vi.mocked(prisma.location.findMany).mockResolvedValue([existing] as any)
    vi.mocked(prisma.location.update).mockResolvedValue({ ...existing, description: "Nouveau" } as any)

    const response = await importLocations(
      makeRequest("http://localhost/api/locations/import", {
        body: { data: [{ Banque: "AMEN", NomEmplacement: "Coffre principal", Description: "Nouveau" }] },
      }),
    )
    const json = await response.json()

    expect(json.updated).toBe(1)
    expect(prisma.location.update).toHaveBeenCalledWith({
      where: { id: "loc-1" },
      data: { description: "Nouveau" },
    })
  })

  it("rejette une ligne dont la banque est introuvable, sans bloquer les autres lignes", async () => {
    vi.mocked(prisma.bank.findMany).mockResolvedValue([bankAmen] as any)
    vi.mocked(prisma.location.findMany).mockResolvedValue([])
    vi.mocked(prisma.location.create).mockImplementation(async ({ data }: any) => ({ id: "loc-new", ...data }) as any)

    const response = await importLocations(
      makeRequest("http://localhost/api/locations/import", {
        body: {
          data: [
            { Banque: "INCONNUE", NomEmplacement: "Coffre X" },
            { Banque: "AMEN", NomEmplacement: "Coffre Y" },
          ],
        },
      }),
    )
    const json = await response.json()

    expect(json.created).toBe(1)
    expect(json.rejected).toBe(1)
    expect(json.errors[0]).toContain("INCONNUE")
  })
})
