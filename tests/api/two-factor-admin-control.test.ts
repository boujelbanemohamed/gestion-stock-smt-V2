import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken, signTwoFactorPendingToken } from "@/lib/auth"
import { generateTotp } from "@/lib/totp"

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    appConfig: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

const sendAuthMethodChangedEmailMock = vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
  sendAuthMethodChangedEmail: sendAuthMethodChangedEmailMock,
}))

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fake") },
}))

const { prisma } = await import("@/lib/db")
const { PATCH: setTwoFactorRequirement } = await import("@/app/api/users/[id]/two-factor/route")
const { POST: resetTwoFactor } = await import("@/app/api/users/[id]/two-factor/reset/route")
const { POST: setupLogin } = await import("@/app/api/auth/2fa/setup-login/route")
const { POST: enableLogin } = await import("@/app/api/auth/2fa/enable-login/route")

const TWO_FACTOR_CONFIG = {
  config: {
    security: {
      twoFactor: {
        enabled: true,
        appName: "Gestion de Stocks",
        issuer: "Gestion de Stocks",
        codeLength: 6,
        codePeriod: 30,
        algorithm: "SHA1",
        mandatory: false,
        mandatoryRoles: [],
        gracePeriodDays: 7,
      },
    },
  },
}

const targetUser = {
  id: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  isActive: true,
  password: "hashed",
  twoFactorEnabled: false,
  twoFactorSecret: null as string | null,
  twoFactorBackupCodes: [] as string[],
}

const superAdminToken = signAccessToken({
  userId: "admin-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "System",
  role: "admin",
})

const regularUserToken = signAccessToken({
  userId: "user-2",
  email: "someone@example.com",
  firstName: "Some",
  lastName: "One",
  role: "user",
})

function adminRequest(body: unknown, token: string) {
  return new NextRequest("http://localhost/api/users/user-1/two-factor", {
    method: "PATCH",
    headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  })
}

function resetRequest(token: string) {
  return new NextRequest("http://localhost/api/users/user-1/two-factor/reset", {
    method: "POST",
    headers: new Headers({ authorization: `Bearer ${token}` }),
  })
}

function loginStepRequest(url: string, body: unknown, forwardedFor: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: new Headers({ "content-type": "application/json", "x-forwarded-for": forwardedFor }),
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/users/[id]/two-factor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await setTwoFactorRequirement(adminRequest({ enabled: true }, regularUserToken), {
      params: { id: "user-1" },
    })
    expect(response.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("active l'exigence de 2FA sans toucher au secret existant, sans notifier immédiatement (configuration à venir)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...targetUser } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...targetUser, twoFactorEnabled: true } as any)

    const response = await setTwoFactorRequirement(adminRequest({ enabled: true }, superAdminToken), {
      params: { id: "user-1" },
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { twoFactorEnabled: true },
    })
    // Pas de secret configuré : /api/auth/2fa/enable-login enverra l'email
    // une fois la configuration effectivement terminée, pas maintenant.
    expect(sendAuthMethodChangedEmailMock).not.toHaveBeenCalled()
  })

  it("active l'exigence de 2FA immédiatement (et notifie) quand un secret est déjà configuré", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...targetUser, twoFactorSecret: "JBSWY3DPEHPK3PXP" } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...targetUser,
      twoFactorEnabled: true,
      twoFactorSecret: "JBSWY3DPEHPK3PXP",
    } as any)

    const response = await setTwoFactorRequirement(adminRequest({ enabled: true }, superAdminToken), {
      params: { id: "user-1" },
    })

    expect(response.status).toBe(200)
    expect(sendAuthMethodChangedEmailMock).toHaveBeenCalledWith(targetUser.email, targetUser.firstName, "2fa")
  })

  it("désactive l'exigence de 2FA en conservant le secret déjà configuré, et notifie immédiatement", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...targetUser,
      twoFactorEnabled: true,
      twoFactorSecret: "JBSWY3DPEHPK3PXP",
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...targetUser, twoFactorEnabled: false } as any)

    const response = await setTwoFactorRequirement(adminRequest({ enabled: false }, superAdminToken), {
      params: { id: "user-1" },
    })

    expect(response.status).toBe(200)
    // Le secret n'est jamais dans les données envoyées à update : il reste intact en base.
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { twoFactorEnabled: false },
    })
    expect(sendAuthMethodChangedEmailMock).toHaveBeenCalledWith(targetUser.email, targetUser.firstName, "password")
  })

  it("refuse un corps de requête invalide (400)", async () => {
    const response = await setTwoFactorRequirement(adminRequest({ enabled: "yes" }, superAdminToken), {
      params: { id: "user-1" },
    })
    expect(response.status).toBe(400)
  })

  it("renvoie 404 si l'utilisateur n'existe pas", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const response = await setTwoFactorRequirement(adminRequest({ enabled: true }, superAdminToken), {
      params: { id: "user-1" },
    })
    expect(response.status).toBe(404)
  })
})

describe("POST /api/users/[id]/two-factor/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuse un utilisateur non-admin (403)", async () => {
    const response = await resetTwoFactor(resetRequest(regularUserToken), { params: { id: "user-1" } })
    expect(response.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("efface le secret et les codes de secours, en conservant l'exigence de 2FA", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...targetUser,
      twoFactorEnabled: true,
      twoFactorSecret: "JBSWY3DPEHPK3PXP",
      twoFactorBackupCodes: ["hash1", "hash2"],
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...targetUser, twoFactorEnabled: true } as any)

    const response = await resetTwoFactor(resetRequest(superAdminToken), { params: { id: "user-1" } })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { twoFactorSecret: null, twoFactorBackupCodes: [] },
    })
  })
})

describe("POST /api/auth/2fa/setup-login puis /api/auth/2fa/enable-login (configuration forcée par un admin)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(TWO_FACTOR_CONFIG as any)
  })

  it("génère un secret quand la 2FA est exigée sans configuration existante", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...targetUser, twoFactorEnabled: true } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)

    const tempToken = signTwoFactorPendingToken(targetUser.id)
    const response = await setupLogin(
      loginStepRequest("http://localhost/api/auth/2fa/setup-login", { tempToken }, "10.0.0.1"),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.secret).toMatch(/^[A-Z2-7]+$/)
    expect(json.data.qrCodeDataUrl).toContain("data:image/png")
  })

  it("refuse si la 2FA n'est pas exigée pour ce compte", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...targetUser, twoFactorEnabled: false } as any)

    const tempToken = signTwoFactorPendingToken(targetUser.id)
    const response = await setupLogin(
      loginStepRequest("http://localhost/api/auth/2fa/setup-login", { tempToken }, "10.0.0.2"),
    )
    expect(response.status).toBe(400)
  })

  it("confirme la configuration avec un code valide, renvoie les tokens de session et des codes de secours", async () => {
    const secret = "JBSWY3DPEHPK3PXP"
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...targetUser,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...targetUser,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
    } as any)

    const tempToken = signTwoFactorPendingToken(targetUser.id)
    const code = generateTotp(secret, { digits: 6, period: 30, algorithm: "SHA1" })
    const response = await enableLogin(
      loginStepRequest("http://localhost/api/auth/2fa/enable-login", { tempToken, code }, "10.0.0.3"),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.accessToken).toBeTruthy()
    expect(json.data.refreshToken).toBeTruthy()
    expect(json.data.backupCodes).toHaveLength(8)
    expect(json.data.user).not.toHaveProperty("twoFactorSecret")
    expect(sendAuthMethodChangedEmailMock).toHaveBeenCalledWith(targetUser.email, targetUser.firstName, "2fa")
  })

  it("refuse un code incorrect et ne délivre aucun token", async () => {
    const secret = "JBSWY3DPEHPK3PXP"
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...targetUser,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
    } as any)

    const tempToken = signTwoFactorPendingToken(targetUser.id)
    const response = await enableLogin(
      loginStepRequest("http://localhost/api/auth/2fa/enable-login", { tempToken, code: "000000" }, "10.0.0.4"),
    )
    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
