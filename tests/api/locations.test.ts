import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    location: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    movement: {
      count: vi.fn(),
    },
    stockLevel: {
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    bank: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { GET, POST } = await import("@/app/api/locations/route")
const { GET: getById, PUT: updateById, DELETE: deleteById } = await import("@/app/api/locations/[id]/route")
const { POST: importLocations } = await import("@/app/api/locations/import/route")

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

const location = {
  id: "loc-1",
  name: "Coffre principal",
  description: null,
  bankId: "bank-1",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("GET /api/locations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/locations", { token: null }))
    expect(response.status).toBe(401)
  })

  it("retourne la liste des emplacements", async () => {
    vi.mocked(prisma.location.findMany).mockResolvedValue([location] as any)
    const response = await GET(makeRequest("http://localhost/api/locations"))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })
})

describe("POST /api/locations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse si des champs requis manquent (400)", async () => {
    const response = await POST(makeRequest("http://localhost/api/locations", { body: {} }))
    expect(response.status).toBe(400)
    expect(prisma.location.create).not.toHaveBeenCalled()
  })

  it("crée un emplacement valide et journalise l'action", async () => {
    vi.mocked(prisma.location.create).mockResolvedValue(location as any)
    const response = await POST(
      makeRequest("http://localhost/api/locations", { body: { name: "Coffre principal", bankId: "bank-1" } }),
    )
    const json = await response.json()
    expect(response.status).toBe(201)
    expect(json.data.name).toBe("Coffre principal")
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "create", module: "locations" }) }),
    )
  })
})

describe("GET /api/locations/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie 404 si l'emplacement n'existe pas", async () => {
    vi.mocked(prisma.location.findUnique).mockResolvedValue(null)
    const response = await getById(makeRequest("http://localhost/api/locations/x"), { params: { id: "x" } })
    expect(response.status).toBe(404)
  })
})

describe("PUT /api/locations/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("met à jour un emplacement et journalise l'action", async () => {
    vi.mocked(prisma.location.update).mockResolvedValue({ ...location, name: "Coffre annexe" } as any)
    const response = await updateById(
      makeRequest("http://localhost/api/locations/loc-1", { method: "PUT", body: { name: "Coffre annexe" } }),
      { params: { id: "loc-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.name).toBe("Coffre annexe")
  })
})

describe("DELETE /api/locations/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie 404 si l'emplacement n'existe pas", async () => {
    vi.mocked(prisma.location.findUnique).mockResolvedValue(null)
    const response = await deleteById(
      makeRequest("http://localhost/api/locations/x", { method: "DELETE" }),
      { params: { id: "x" } },
    )
    expect(response.status).toBe(404)
  })

  it("refuse la suppression si des mouvements y sont associés (400)", async () => {
    vi.mocked(prisma.location.findUnique).mockResolvedValue(location as any)
    vi.mocked(prisma.movement.count).mockResolvedValue(3)

    const response = await deleteById(
      makeRequest("http://localhost/api/locations/loc-1", { method: "DELETE" }),
      { params: { id: "loc-1" } },
    )
    expect(response.status).toBe(400)
    expect(prisma.location.delete).not.toHaveBeenCalled()
  })

  it("refuse la suppression si du stock y est présent (400)", async () => {
    vi.mocked(prisma.location.findUnique).mockResolvedValue(location as any)
    vi.mocked(prisma.movement.count).mockResolvedValue(0)
    vi.mocked(prisma.stockLevel.count).mockResolvedValue(2)

    const response = await deleteById(
      makeRequest("http://localhost/api/locations/loc-1", { method: "DELETE" }),
      { params: { id: "loc-1" } },
    )
    expect(response.status).toBe(400)
    expect(prisma.location.delete).not.toHaveBeenCalled()
  })

  it("supprime l'emplacement s'il n'a ni mouvement ni stock associé", async () => {
    vi.mocked(prisma.location.findUnique).mockResolvedValue(location as any)
    vi.mocked(prisma.movement.count).mockResolvedValue(0)
    vi.mocked(prisma.stockLevel.count).mockResolvedValue(0)
    vi.mocked(prisma.location.delete).mockResolvedValue(location as any)

    const response = await deleteById(
      makeRequest("http://localhost/api/locations/loc-1", { method: "DELETE" }),
      { params: { id: "loc-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "delete", module: "locations" }) }),
    )
  })
})

describe("POST /api/locations/import", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un format de données invalide (400)", async () => {
    const response = await importLocations(
      makeRequest("http://localhost/api/locations/import", { body: { data: "x" } }),
    )
    expect(response.status).toBe(400)
  })
})
