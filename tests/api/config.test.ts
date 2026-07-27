import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    appConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

const verifyMock = vi.fn().mockResolvedValue(undefined)
const sendMailMock = vi.fn().mockResolvedValue(undefined)
vi.mock("nodemailer", () => ({
  createTransport: vi.fn(() => ({ verify: verifyMock, sendMail: sendMailMock })),
}))

const { prisma } = await import("@/lib/db")
const { GET, PUT } = await import("@/app/api/config/route")
const { POST: testSmtp } = await import("@/app/api/config/test-smtp/route")

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

const configRecord = {
  id: "singleton",
  config: {
    general: { companyName: "Monetique" },
    smtp: { host: "smtp.gmail.com", username: "user@gmail.com", password: "secret" },
  },
}

describe("GET /api/config", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/config", { token: null }))
    expect(response.status).toBe(401)
  })

  it("masque le mot de passe SMTP pour un utilisateur non-admin", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(configRecord as any)
    const response = await GET(makeRequest("http://localhost/api/config", { token: userToken }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.smtp.password).toBe("••••••••")
  })

  it("expose le mot de passe SMTP en clair pour un admin", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(configRecord as any)
    const response = await GET(makeRequest("http://localhost/api/config"))
    const json = await response.json()

    expect(json.data.smtp.password).toBe("secret")
  })

  it("crée une configuration par défaut si elle n'existe pas encore", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.appConfig.create).mockResolvedValue(configRecord as any)

    const response = await GET(makeRequest("http://localhost/api/config"))
    expect(response.status).toBe(200)
    expect(prisma.appConfig.create).toHaveBeenCalled()
  })
})

describe("PUT /api/config", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await PUT(makeRequest("http://localhost/api/config", { method: "PUT", token: userToken, body: {} }))
    expect(response.status).toBe(403)
  })

  it("met à jour la configuration et journalise l'action", async () => {
    vi.mocked(prisma.appConfig.upsert).mockResolvedValue({ ...configRecord, config: { general: { companyName: "New Name" } } } as any)

    const response = await PUT(
      makeRequest("http://localhost/api/config", { method: "PUT", body: { general: { companyName: "New Name" } } }),
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.general.companyName).toBe("New Name")
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "update", module: "config" }) }),
    )
  })
})

describe("POST /api/config/test-smtp", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await testSmtp(
      makeRequest("http://localhost/api/config/test-smtp", { token: userToken, body: {} }),
    )
    expect(response.status).toBe(403)
  })

  it("refuse une configuration SMTP incomplète (400)", async () => {
    const response = await testSmtp(
      makeRequest("http://localhost/api/config/test-smtp", { body: { smtp: { host: "smtp.gmail.com" } } }),
    )
    expect(response.status).toBe(400)
  })

  it("refuse sans email de test (400)", async () => {
    const response = await testSmtp(
      makeRequest("http://localhost/api/config/test-smtp", {
        body: { smtp: { host: "smtp.gmail.com", username: "u", password: "p" } },
      }),
    )
    expect(response.status).toBe(400)
  })

  it("envoie un email de test quand la configuration est valide", async () => {
    const response = await testSmtp(
      makeRequest("http://localhost/api/config/test-smtp", {
        body: {
          smtp: { host: "smtp.gmail.com", username: "u", password: "p", fromEmail: "noreply@x.tn" },
          testEmail: "admin@example.com",
        },
      }),
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(sendMailMock).toHaveBeenCalled()
  })
})
