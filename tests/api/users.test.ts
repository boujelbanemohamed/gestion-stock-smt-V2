import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import * as bcrypt from "bcryptjs"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

const sendPasswordChangedConfirmationEmailMock = vi.fn().mockResolvedValue(true)
vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
  sendUserWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordChangedConfirmationEmail: sendPasswordChangedConfirmationEmailMock,
}))

vi.mock("@/lib/notification-helper", () => ({
  createUserActivityNotification: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { GET, POST } = await import("@/app/api/users/route")
const { GET: getById, PUT: updateById, DELETE: deleteById } = await import("@/app/api/users/[id]/route")

const adminToken = signAccessToken({
  userId: "admin-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "System",
  role: "admin",
})

const otherUserToken = signAccessToken({
  userId: "user-2",
  email: "other@example.com",
  firstName: "Other",
  lastName: "User",
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

const targetUser = {
  id: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  isActive: true,
  password: bcrypt.hashSync("secret", 4),
  twoFactorEnabled: false,
  twoFactorSecret: null,
  twoFactorBackupCodes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("GET /api/users", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/users", { token: null }))
    expect(response.status).toBe(401)
  })

  it("retourne les utilisateurs sans les champs sensibles", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([targetUser] as any)
    const response = await GET(makeRequest("http://localhost/api/users"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0]).not.toHaveProperty("password")
    expect(json.data[0]).not.toHaveProperty("twoFactorSecret")
  })
})

describe("POST /api/users", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await POST(
      makeRequest("http://localhost/api/users", {
        token: otherUserToken,
        body: { email: "new@example.com", firstName: "New", lastName: "User", role: "user" },
      }),
    )
    expect(response.status).toBe(403)
  })

  it("refuse si des champs requis manquent (400)", async () => {
    const response = await POST(makeRequest("http://localhost/api/users", { body: { email: "new@example.com" } }))
    expect(response.status).toBe(400)
  })

  it("refuse si l'email existe déjà (400)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser as any)
    const response = await POST(
      makeRequest("http://localhost/api/users", {
        body: { email: "jane@example.com", firstName: "Jane", lastName: "Doe", role: "user" },
      }),
    )
    expect(response.status).toBe(400)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it("crée un utilisateur et renvoie le mot de passe généré (sans l'envoyer par email)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue(targetUser as any)

    const response = await POST(
      makeRequest("http://localhost/api/users", {
        body: { email: "jane@example.com", firstName: "Jane", lastName: "Doe", role: "user" },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data).not.toHaveProperty("password")
    expect(json.generatedPassword).toBeTruthy()
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "create", module: "users" }) }),
    )
  })
})

describe("GET /api/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie 404 si l'utilisateur n'existe pas", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const response = await getById(makeRequest("http://localhost/api/users/x"), { params: { id: "x" } })
    expect(response.status).toBe(404)
  })
})

describe("PUT /api/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse qu'un utilisateur modifie le profil d'un tiers (403)", async () => {
    const response = await updateById(
      makeRequest("http://localhost/api/users/user-1", { method: "PUT", token: otherUserToken, body: { firstName: "X" } }),
      { params: { id: "user-1" } },
    )
    expect(response.status).toBe(403)
  })

  it("ignore une tentative de changement de rôle par un non-admin sur son propre compte", async () => {
    const selfToken = signAccessToken({
      userId: "user-1",
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Doe",
      role: "user",
    })
    vi.mocked(prisma.user.update).mockResolvedValue(targetUser as any)

    await updateById(
      makeRequest("http://localhost/api/users/user-1", {
        method: "PUT",
        token: selfToken,
        body: { firstName: "Jane2", role: "admin" },
      }),
      { params: { id: "user-1" } },
    )

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { firstName: "Jane2" },
    })
  })

  it("permet à un admin de changer le rôle et le statut", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ ...targetUser, role: "manager", isActive: false } as any)

    const response = await updateById(
      makeRequest("http://localhost/api/users/user-1", { method: "PUT", body: { role: "manager", isActive: false } }),
      { params: { id: "user-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.role).toBe("manager")
    expect(sendPasswordChangedConfirmationEmailMock).not.toHaveBeenCalled()
  })

  it("envoie un email de confirmation quand le mot de passe est modifié", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue(targetUser as any)

    const response = await updateById(
      makeRequest("http://localhost/api/users/user-1", { method: "PUT", body: { password: "nouveau-mot-de-passe" } }),
      { params: { id: "user-1" } },
    )

    expect(response.status).toBe(200)
    expect(sendPasswordChangedConfirmationEmailMock).toHaveBeenCalledWith(targetUser.email, targetUser.firstName)
  })
})

describe("DELETE /api/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await deleteById(
      makeRequest("http://localhost/api/users/user-1", { method: "DELETE", token: otherUserToken }),
      { params: { id: "user-1" } },
    )
    expect(response.status).toBe(403)
  })

  it("désactive l'utilisateur (pas de suppression physique) et journalise l'action", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser as any)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...targetUser, isActive: false } as any)

    const response = await deleteById(
      makeRequest("http://localhost/api/users/user-1", { method: "DELETE" }),
      { params: { id: "user-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { isActive: false } })
  })
})
