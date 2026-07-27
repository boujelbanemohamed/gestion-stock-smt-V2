import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  prisma: {
    appConfig: {
      findUnique: vi.fn(),
    },
  },
}))

const { prisma } = await import("@/lib/db")
const { getLoginSecuritySettings } = await import("@/lib/security-config")

describe("getLoginSecuritySettings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie les valeurs configurées dans Configuration > Sécurité", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
      config: { security: { maxLoginAttempts: 3, lockoutDuration: 15 } },
    } as any)

    const result = await getLoginSecuritySettings()
    expect(result).toEqual({ maxLoginAttempts: 3, lockoutDuration: 15 })
  })

  it("retombe sur les valeurs par défaut quand la configuration n'existe pas", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null)

    const result = await getLoginSecuritySettings()
    expect(result).toEqual({ maxLoginAttempts: 5, lockoutDuration: 30 })
  })

  it("retombe sur les valeurs par défaut quand la section sécurité est absente", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({ config: {} } as any)

    const result = await getLoginSecuritySettings()
    expect(result).toEqual({ maxLoginAttempts: 5, lockoutDuration: 30 })
  })

  it("complète les champs manquants individuellement avec leur valeur par défaut", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
      config: { security: { maxLoginAttempts: 10 } },
    } as any)

    const result = await getLoginSecuritySettings()
    expect(result).toEqual({ maxLoginAttempts: 10, lockoutDuration: 30 })
  })
})
