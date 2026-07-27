import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  prisma: {
    appConfig: {
      findUnique: vi.fn(),
    },
  },
}))

const { prisma } = await import("@/lib/db")
const { getTwoFactorSettings } = await import("@/lib/two-factor-config")

const DEFAULTS = {
  enabled: false,
  appName: "Monetique Tunisie",
  issuer: "Monetique",
  codeLength: 6,
  codePeriod: 30,
  algorithm: "SHA1",
  mandatory: false,
  mandatoryRoles: [],
  gracePeriodDays: 7,
}

describe("getTwoFactorSettings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie les valeurs par défaut quand la configuration n'existe pas", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(null)
    const result = await getTwoFactorSettings()
    expect(result).toEqual(DEFAULTS)
  })

  it("renvoie les valeurs configurées telles quelles", async () => {
    const configured = {
      enabled: true,
      appName: "Ma Plateforme",
      issuer: "MaPlateforme",
      codeLength: 8,
      codePeriod: 60,
      algorithm: "SHA256",
      mandatory: true,
      mandatoryRoles: ["admin"],
      gracePeriodDays: 3,
    }
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
      config: { security: { twoFactor: configured } },
    } as any)

    const result = await getTwoFactorSettings()
    expect(result).toEqual(configured)
  })

  it("complète les champs partiellement configurés avec les valeurs par défaut", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
      config: { security: { twoFactor: { enabled: true, mandatory: true } } },
    } as any)

    const result = await getTwoFactorSettings()
    expect(result).toEqual({ ...DEFAULTS, enabled: true, mandatory: true })
  })
})
