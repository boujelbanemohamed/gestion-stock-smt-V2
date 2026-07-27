import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    bank: {
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

const { prisma } = await import("@/lib/db")
const { GET, POST } = await import("@/app/api/banks/route")
const { GET: getById, PUT: updateById, DELETE: deleteById } = await import("@/app/api/banks/[id]/route")
const { POST: importBanks } = await import("@/app/api/banks/import/route")

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

const bank = {
  id: "bank-1",
  name: "Amen Bank",
  code: "AMEN",
  address: "",
  phone: "",
  email: "",
  country: "Tunisie",
  swiftCode: "AMENTNTT",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("GET /api/banks", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await GET(makeRequest("http://localhost/api/banks", { token: null }))
    expect(response.status).toBe(401)
  })

  it("retourne la liste des banques pour un utilisateur authentifié", async () => {
    vi.mocked(prisma.bank.findMany).mockResolvedValue([bank] as any)
    const response = await GET(makeRequest("http://localhost/api/banks"))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].code).toBe("AMEN")
  })
})

describe("POST /api/banks", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse si des champs requis manquent (400)", async () => {
    const response = await POST(makeRequest("http://localhost/api/banks", { body: { name: "Test" } }))
    expect(response.status).toBe(400)
    expect(prisma.bank.create).not.toHaveBeenCalled()
  })

  it("refuse un code SWIFT invalide (400)", async () => {
    const response = await POST(
      makeRequest("http://localhost/api/banks", {
        body: { name: "Test", code: "TST", country: "Tunisie", swiftCode: "invalid" },
      }),
    )
    expect(response.status).toBe(400)
  })

  it("refuse si le code banque existe déjà (400)", async () => {
    vi.mocked(prisma.bank.findUnique).mockResolvedValue(bank as any)
    const response = await POST(
      makeRequest("http://localhost/api/banks", {
        body: { name: "Amen Bank", code: "AMEN", country: "Tunisie", swiftCode: "AMENTNTT" },
      }),
    )
    expect(response.status).toBe(400)
    expect(prisma.bank.create).not.toHaveBeenCalled()
  })

  it("crée une banque valide et journalise l'action", async () => {
    vi.mocked(prisma.bank.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.bank.create).mockResolvedValue(bank as any)

    const response = await POST(
      makeRequest("http://localhost/api/banks", {
        body: { name: "Amen Bank", code: "AMEN", country: "Tunisie", swiftCode: "AMENTNTT" },
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.data.code).toBe("AMEN")
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "create", module: "banks" }) }),
    )
  })
})

describe("GET /api/banks/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie 404 si la banque n'existe pas", async () => {
    vi.mocked(prisma.bank.findUnique).mockResolvedValue(null)
    const response = await getById(makeRequest("http://localhost/api/banks/x"), { params: { id: "x" } })
    expect(response.status).toBe(404)
  })

  it("renvoie la banque si elle existe", async () => {
    vi.mocked(prisma.bank.findUnique).mockResolvedValue(bank as any)
    const response = await getById(makeRequest("http://localhost/api/banks/bank-1"), { params: { id: "bank-1" } })
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.id).toBe("bank-1")
  })
})

describe("PUT /api/banks/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("met à jour une banque et journalise l'action", async () => {
    vi.mocked(prisma.bank.update).mockResolvedValue({ ...bank, name: "Amen Bank SA" } as any)
    const response = await updateById(
      makeRequest("http://localhost/api/banks/bank-1", { method: "PUT", body: { name: "Amen Bank SA" } }),
      { params: { id: "bank-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.name).toBe("Amen Bank SA")
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "update", module: "banks" }) }),
    )
  })
})

describe("DELETE /api/banks/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("supprime une banque et journalise l'action", async () => {
    vi.mocked(prisma.bank.findUnique).mockResolvedValue(bank as any)
    vi.mocked(prisma.bank.delete).mockResolvedValue(bank as any)

    const response = await deleteById(
      makeRequest("http://localhost/api/banks/bank-1", { method: "DELETE" }),
      { params: { id: "bank-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "delete", module: "banks" }) }),
    )
  })
})

describe("POST /api/banks/import", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un format de données invalide (400)", async () => {
    const response = await importBanks(makeRequest("http://localhost/api/banks/import", { body: { data: "x" } }))
    expect(response.status).toBe(400)
  })

  it("crée les nouvelles banques et rejette les lignes incomplètes", async () => {
    vi.mocked(prisma.bank.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.bank.create).mockResolvedValue(bank as any)

    const response = await importBanks(
      makeRequest("http://localhost/api/banks/import", {
        body: {
          data: [
            { CodeBanque: "AMEN", NomBanque: "Amen Bank", Pays: "Tunisie", SwiftCode: "AMENTNTT" },
            { CodeBanque: "", NomBanque: "", Pays: "", SwiftCode: "" },
          ],
        },
      }),
    )
    const json = await response.json()

    expect(json.created).toBe(1)
    expect(json.rejected).toBe(1)
    expect(json.errors).toHaveLength(1)
  })
})
