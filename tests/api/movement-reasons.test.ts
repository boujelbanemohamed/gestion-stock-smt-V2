import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

// Mocke Prisma : ces tests exercent la logique de la route (garde d'auth,
// validation, auto-seed, audit) sans jamais toucher une vraie base de données.
vi.mock("@/lib/db", () => ({
  prisma: {
    movementReason: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/notification-helper", () => ({
  createUserActivityNotification: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { GET, POST } = await import("@/app/api/movement-reasons/route")
const { PUT: updateById, DELETE: deleteById } = await import("@/app/api/movement-reasons/[id]/route")

function makeRequest(options: { token?: string; body?: unknown } = {}) {
  const headers = new Headers({ "content-type": "application/json" })
  if (options.token) headers.set("authorization", `Bearer ${options.token}`)
  return new NextRequest("http://localhost/api/movement-reasons", {
    method: options.body ? "POST" : "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

function makeIdRequest(id: string, options: { method: "PUT" | "DELETE"; token?: string; body?: unknown }) {
  const headers = new Headers({ "content-type": "application/json" })
  if (options.token) headers.set("authorization", `Bearer ${options.token}`)
  return new NextRequest(`http://localhost/api/movement-reasons/${id}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

const userToken = signAccessToken({
  userId: "user-1",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
})

const adminToken = signAccessToken({
  userId: "admin-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Istrator",
  role: "admin",
})

describe("GET /api/movement-reasons", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuse une requête non authentifiée", async () => {
    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
  })

  it("renvoie les motifs existants sans les recréer", async () => {
    const existing = [{ id: "r1", label: "Autre", isOther: true, isActive: true }]
    vi.mocked(prisma.movementReason.findMany).mockResolvedValue(existing as any)

    const response = await GET(makeRequest({ token: userToken }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual(existing)
    expect(prisma.movementReason.createMany).not.toHaveBeenCalled()
  })

  it("amorce les motifs par défaut (dont 'Autre') si la table est vide", async () => {
    const seeded = [
      { id: "r1", label: "Fabrication", isOther: false, isActive: true },
      { id: "r7", label: "Autre", isOther: true, isActive: true },
    ]
    vi.mocked(prisma.movementReason.findMany)
      .mockResolvedValueOnce([] as any) // premier appel : table vide
      .mockResolvedValueOnce(seeded as any) // relecture après le seed

    const response = await GET(makeRequest({ token: userToken }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.movementReason.createMany).toHaveBeenCalledTimes(1)
    const seedData = vi.mocked(prisma.movementReason.createMany).mock.calls[0][0]?.data as Array<{
      label: string
      isOther?: boolean
    }>
    expect(seedData.some((r) => r.label === "Autre" && r.isOther === true)).toBe(true)
    expect(json.data).toEqual(seeded)
  })
})

describe("POST /api/movement-reasons", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await POST(makeRequest({ token: userToken, body: { label: "Nouveau motif" } }))
    expect(response.status).toBe(403)
    expect(prisma.movementReason.create).not.toHaveBeenCalled()
  })

  it("refuse un libellé vide (400)", async () => {
    const response = await POST(makeRequest({ token: adminToken, body: { label: "   " } }))
    expect(response.status).toBe(400)
    expect(prisma.movementReason.create).not.toHaveBeenCalled()
  })

  it("crée le motif pour un admin avec un libellé valide", async () => {
    const created = { id: "r99", label: "Retour fournisseur", isOther: false, isActive: true }
    vi.mocked(prisma.movementReason.create).mockResolvedValue(created as any)

    const response = await POST(makeRequest({ token: adminToken, body: { label: "  Retour fournisseur  " } }))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data).toEqual(created)
    // Le libellé doit être nettoyé (trim) et jamais créé en tant que motif protégé "Autre".
    expect(prisma.movementReason.create).toHaveBeenCalledWith({
      data: { label: "Retour fournisseur", isOther: false },
    })
  })
})

describe("PUT /api/movement-reasons/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await updateById(
      makeIdRequest("r1", { method: "PUT", token: userToken, body: { label: "X" } }),
      { params: { id: "r1" } },
    )
    expect(response.status).toBe(403)
    expect(prisma.movementReason.update).not.toHaveBeenCalled()
  })

  it("renvoie 404 si le motif n'existe pas", async () => {
    vi.mocked(prisma.movementReason.findUnique).mockResolvedValue(null)
    const response = await updateById(
      makeIdRequest("bogus", { method: "PUT", token: adminToken, body: { label: "X" } }),
      { params: { id: "bogus" } },
    )
    expect(response.status).toBe(404)
  })

  it("refuse un libellé vide (400)", async () => {
    vi.mocked(prisma.movementReason.findUnique).mockResolvedValue({
      id: "r1",
      label: "Fabrication",
      isOther: false,
      isActive: true,
    } as any)

    const response = await updateById(
      makeIdRequest("r1", { method: "PUT", token: adminToken, body: { label: "   " } }),
      { params: { id: "r1" } },
    )
    expect(response.status).toBe(400)
    expect(prisma.movementReason.update).not.toHaveBeenCalled()
  })

  it("met à jour le libellé et/ou le statut actif, et journalise l'action", async () => {
    vi.mocked(prisma.movementReason.findUnique).mockResolvedValue({
      id: "r1",
      label: "Fabrication",
      isOther: false,
      isActive: true,
    } as any)
    const updated = { id: "r1", label: "Production", isOther: false, isActive: false }
    vi.mocked(prisma.movementReason.update).mockResolvedValue(updated as any)

    const response = await updateById(
      makeIdRequest("r1", { method: "PUT", token: adminToken, body: { label: "  Production  ", isActive: false } }),
      { params: { id: "r1" } },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual(updated)
    expect(prisma.movementReason.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { label: "Production", isActive: false },
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "update", module: "config" }) }),
    )
  })
})

describe("DELETE /api/movement-reasons/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await deleteById(makeIdRequest("r1", { method: "DELETE", token: userToken }), {
      params: { id: "r1" },
    })
    expect(response.status).toBe(403)
    expect(prisma.movementReason.delete).not.toHaveBeenCalled()
  })

  it("renvoie 404 si le motif n'existe pas", async () => {
    vi.mocked(prisma.movementReason.findUnique).mockResolvedValue(null)
    const response = await deleteById(makeIdRequest("bogus", { method: "DELETE", token: adminToken }), {
      params: { id: "bogus" },
    })
    expect(response.status).toBe(404)
  })

  it("refuse la suppression du motif protégé \"Autre\" (403)", async () => {
    vi.mocked(prisma.movementReason.findUnique).mockResolvedValue({
      id: "r7",
      label: "Autre",
      isOther: true,
      isActive: true,
    } as any)

    const response = await deleteById(makeIdRequest("r7", { method: "DELETE", token: adminToken }), {
      params: { id: "r7" },
    })
    expect(response.status).toBe(403)
    expect(prisma.movementReason.delete).not.toHaveBeenCalled()
  })

  it("supprime un motif non protégé et journalise l'action", async () => {
    vi.mocked(prisma.movementReason.findUnique).mockResolvedValue({
      id: "r1",
      label: "Fabrication",
      isOther: false,
      isActive: true,
    } as any)
    vi.mocked(prisma.movementReason.delete).mockResolvedValue({} as any)

    const response = await deleteById(makeIdRequest("r1", { method: "DELETE", token: adminToken }), {
      params: { id: "r1" },
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.movementReason.delete).toHaveBeenCalledWith({ where: { id: "r1" } })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "delete", module: "config" }) }),
    )
  })
})
