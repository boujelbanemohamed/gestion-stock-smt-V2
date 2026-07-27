import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { POST: logout } = await import("@/app/api/auth/logout/route")

const userPayload = {
  userId: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
}

function logoutRequest(token?: string) {
  const headers = new Headers()
  if (token) headers.set("authorization", `Bearer ${token}`)
  return new NextRequest("http://localhost/api/auth/logout", { method: "POST", headers })
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("journalise la déconnexion quand un token valide est fourni", async () => {
    const token = signAccessToken(userPayload)
    const response = await logout(logoutRequest(token))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: userPayload.userId, action: "logout", status: "success" }),
      }),
    )
  })

  it("réussit quand même sans token valide, sans rien journaliser", async () => {
    const response = await logout(logoutRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })
})
