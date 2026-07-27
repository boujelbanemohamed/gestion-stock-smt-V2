import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/server-events", () => ({
  serverEvents: { emit: vi.fn() },
}))

const { prisma } = await import("@/lib/db")
const { serverEvents } = await import("@/lib/server-events")
const { GET, POST } = await import("@/app/api/notifications/route")
const { PUT: updateById, DELETE: deleteById } = await import("@/app/api/notifications/[id]/route")

const token = signAccessToken({
  userId: "user-1",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
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

const notification = {
  id: "notif-1",
  type: "info",
  title: "Stock bas",
  message: "La carte X est en stock bas",
  userId: null,
  isRead: false,
  createdAt: new Date(),
}

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/notifications", { token: null }))
    expect(response.status).toBe(401)
  })

  it("retourne les notifications globales quand aucun userId n'est fourni", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([notification] as any)
    const response = await GET(makeRequest("http://localhost/api/notifications"))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })
})

describe("POST /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks())

  it("crée une notification et la pousse en temps réel (SSE)", async () => {
    vi.mocked(prisma.notification.create).mockResolvedValue(notification as any)

    const response = await POST(
      makeRequest("http://localhost/api/notifications", {
        body: { type: "info", title: "Stock bas", message: "La carte X est en stock bas" },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data.title).toBe("Stock bas")
    expect(serverEvents.emit).toHaveBeenCalledWith("notification", notification)
  })
})

describe("PUT /api/notifications/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("marque une notification comme lue", async () => {
    vi.mocked(prisma.notification.update).mockResolvedValue({ ...notification, isRead: true } as any)
    const response = await updateById(
      makeRequest("http://localhost/api/notifications/notif-1", { method: "PUT", body: { isRead: true } }),
      { params: { id: "notif-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.isRead).toBe(true)
  })
})

describe("DELETE /api/notifications/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("supprime une notification", async () => {
    vi.mocked(prisma.notification.delete).mockResolvedValue(notification as any)
    const response = await deleteById(
      makeRequest("http://localhost/api/notifications/notif-1", { method: "DELETE" }),
      { params: { id: "notif-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })
})
