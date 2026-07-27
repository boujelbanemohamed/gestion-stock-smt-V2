import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken, signRefreshToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { GET: getMe } = await import("@/app/api/auth/me/route")
const { POST: refresh } = await import("@/app/api/auth/refresh/route")

const userRecord = {
  id: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  isActive: true,
  password: "hashed",
  twoFactorEnabled: false,
  twoFactorSecret: null,
  twoFactorBackupCodes: [],
}

function meRequest(token?: string) {
  const headers = new Headers()
  if (token) headers.set("authorization", `Bearer ${token}`)
  return new NextRequest("http://localhost/api/auth/me", { headers })
}

function refreshRequest(body: unknown, forwardedFor = "10.2.0.1") {
  return new NextRequest("http://localhost/api/auth/refresh", {
    method: "POST",
    headers: new Headers({ "content-type": "application/json", "x-forwarded-for": forwardedFor }),
    body: JSON.stringify(body),
  })
}

describe("GET /api/auth/me", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête sans token (401)", async () => {
    const response = await getMe(meRequest())
    expect(response.status).toBe(401)
  })

  it("renvoie l'utilisateur courant sans champs sensibles", async () => {
    const token = signAccessToken({
      userId: userRecord.id,
      email: userRecord.email,
      firstName: userRecord.firstName,
      lastName: userRecord.lastName,
      role: userRecord.role,
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(userRecord as any)

    const response = await getMe(meRequest(token))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.email).toBe(userRecord.email)
    expect(json.data).not.toHaveProperty("password")
  })

  it("renvoie 404 si l'utilisateur n'existe plus", async () => {
    const token = signAccessToken({
      userId: "ghost",
      email: "ghost@example.com",
      firstName: "Ghost",
      lastName: "User",
      role: "user",
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const response = await getMe(meRequest(token))
    expect(response.status).toBe(404)
  })
})

describe("POST /api/auth/refresh", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête sans refresh token (400)", async () => {
    const response = await refresh(refreshRequest({}))
    expect(response.status).toBe(400)
  })

  it("refuse un refresh token invalide (401)", async () => {
    const response = await refresh(refreshRequest({ refreshToken: "bogus" }))
    expect(response.status).toBe(401)
  })

  it("délivre un nouveau access token pour un refresh token valide", async () => {
    const refreshToken = signRefreshToken({
      userId: userRecord.id,
      email: userRecord.email,
      firstName: userRecord.firstName,
      lastName: userRecord.lastName,
      role: userRecord.role,
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(userRecord as any)

    const response = await refresh(refreshRequest({ refreshToken }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.accessToken).toBeTruthy()
  })

  it("refuse si l'utilisateur est désactivé", async () => {
    const refreshToken = signRefreshToken({
      userId: userRecord.id,
      email: userRecord.email,
      firstName: userRecord.firstName,
      lastName: userRecord.lastName,
      role: userRecord.role,
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...userRecord, isActive: false } as any)

    const response = await refresh(refreshRequest({ refreshToken }, "10.2.0.2"))
    expect(response.status).toBe(401)
  })
})
