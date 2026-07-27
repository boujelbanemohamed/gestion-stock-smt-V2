import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    rolePermission: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
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
const { GET, POST } = await import("@/app/api/roles/route")
const { PUT: updateById, DELETE: deleteById } = await import("@/app/api/roles/[id]/route")

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
  const tok = options.token === undefined ? adminToken : options.token
  if (tok) headers.set("authorization", `Bearer ${tok}`)
  return new NextRequest(url, {
    method: options.method || (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

const customRole = {
  id: "role-1",
  role: "expedition",
  permissions: ["dashboard:view"],
  description: "Expédition",
  isCustom: true,
}

const systemRole = {
  id: "role-admin",
  role: "admin",
  permissions: ["dashboard:view"],
  description: "Administrateur",
  isCustom: false,
}

describe("GET /api/roles", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/roles", { token: null }))
    expect(response.status).toBe(401)
  })

  it("est accessible à tout utilisateur authentifié (pas seulement les admins)", async () => {
    vi.mocked(prisma.rolePermission.findMany).mockResolvedValue([customRole] as any)
    const response = await GET(makeRequest("http://localhost/api/roles", { token: userToken }))
    expect(response.status).toBe(200)
  })
})

describe("POST /api/roles", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await POST(
      makeRequest("http://localhost/api/roles", { token: userToken, body: { role: "x", permissions: [] } }),
    )
    expect(response.status).toBe(403)
  })

  it("refuse si des champs requis manquent (400)", async () => {
    const response = await POST(makeRequest("http://localhost/api/roles", { body: { role: "expedition" } }))
    expect(response.status).toBe(400)
  })

  it("crée un rôle et journalise l'action", async () => {
    vi.mocked(prisma.rolePermission.create).mockResolvedValue(customRole as any)
    const response = await POST(
      makeRequest("http://localhost/api/roles", {
        body: { role: "expedition", permissions: ["dashboard:view"], description: "Expédition" },
      }),
    )
    const json = await response.json()
    expect(response.status).toBe(201)
    expect(json.data.role).toBe("expedition")
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "create", module: "roles" }) }),
    )
  })
})

describe("PUT /api/roles/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await updateById(
      makeRequest("http://localhost/api/roles/role-1", { method: "PUT", token: userToken, body: {} }),
      { params: { id: "role-1" } },
    )
    expect(response.status).toBe(403)
  })

  it("renvoie 404 si le rôle n'existe pas", async () => {
    vi.mocked(prisma.rolePermission.findUnique).mockResolvedValue(null)
    const response = await updateById(
      makeRequest("http://localhost/api/roles/x", { method: "PUT", body: {} }),
      { params: { id: "x" } },
    )
    expect(response.status).toBe(404)
  })

  it("refuse de renommer un rôle système (403)", async () => {
    vi.mocked(prisma.rolePermission.findUnique).mockResolvedValue(systemRole as any)
    const response = await updateById(
      makeRequest("http://localhost/api/roles/role-admin", { method: "PUT", body: { role: "superadmin" } }),
      { params: { id: "role-admin" } },
    )
    expect(response.status).toBe(403)
    expect(prisma.rolePermission.update).not.toHaveBeenCalled()
  })

  it("met à jour les permissions d'un rôle personnalisé", async () => {
    vi.mocked(prisma.rolePermission.findUnique).mockResolvedValue(customRole as any)
    vi.mocked(prisma.rolePermission.update).mockResolvedValue({ ...customRole, permissions: ["dashboard:view", "banks:view"] } as any)

    const response = await updateById(
      makeRequest("http://localhost/api/roles/role-1", {
        method: "PUT",
        body: { permissions: ["dashboard:view", "banks:view"] },
      }),
      { params: { id: "role-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.permissions).toContain("banks:view")
  })
})

describe("DELETE /api/roles/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse de supprimer un rôle système (403)", async () => {
    vi.mocked(prisma.rolePermission.findUnique).mockResolvedValue(systemRole as any)
    const response = await deleteById(
      makeRequest("http://localhost/api/roles/role-admin", { method: "DELETE" }),
      { params: { id: "role-admin" } },
    )
    expect(response.status).toBe(403)
    expect(prisma.rolePermission.delete).not.toHaveBeenCalled()
  })

  it("supprime un rôle personnalisé et journalise l'action", async () => {
    vi.mocked(prisma.rolePermission.findUnique).mockResolvedValue(customRole as any)
    vi.mocked(prisma.rolePermission.delete).mockResolvedValue(customRole as any)

    const response = await deleteById(
      makeRequest("http://localhost/api/roles/role-1", { method: "DELETE" }),
      { params: { id: "role-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "delete", module: "roles" }) }),
    )
  })
})
