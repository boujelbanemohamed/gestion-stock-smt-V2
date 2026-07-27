import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const { prisma } = await import("@/lib/db")
const { GET, POST } = await import("@/app/api/logs/route")

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

const logEntry = {
  id: "log-1",
  timestamp: new Date(),
  userId: "user-1",
  userEmail: "user@example.com",
  action: "login",
  module: "auth",
  entityType: "user",
  details: "Connexion réussie",
  status: "success",
}

describe("GET /api/logs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/logs", { token: null }))
    expect(response.status).toBe(401)
  })

  it("retourne les logs paginés", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1)
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([logEntry] as any)

    const response = await GET(makeRequest("http://localhost/api/logs"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it("filtre par module et statut", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0)
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])

    await GET(makeRequest("http://localhost/api/logs?module=auth&status=failure"))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ module: "auth", status: "failure" }) }),
    )
  })
})

describe("POST /api/logs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("crée un log d'audit manuellement", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue(logEntry as any)

    const response = await POST(
      makeRequest("http://localhost/api/logs", {
        body: {
          userId: "user-1",
          userEmail: "user@example.com",
          action: "view",
          module: "reports",
          entityType: "report",
          details: "Consultation du rapport mensuel",
        },
      }),
    )

    expect(response.status).toBe(201)
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })
})
