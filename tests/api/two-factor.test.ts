import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import * as bcrypt from "bcryptjs"
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
const { POST: setupTwoFactor } = await import("@/app/api/auth/2fa/setup/route")
const { POST: enableTwoFactor } = await import("@/app/api/auth/2fa/enable/route")
const { POST: disableTwoFactor } = await import("@/app/api/auth/2fa/disable/route")
const { POST: verifyLogin } = await import("@/app/api/auth/2fa/verify-login/route")

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

const baseUser = {
  id: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  isActive: true,
  password: bcrypt.hashSync("correct-password", 4),
  twoFactorEnabled: false,
  twoFactorSecret: null as string | null,
  twoFactorBackupCodes: [] as string[],
}

function authedRequest(body: unknown, token: string) {
  return new NextRequest("http://localhost/api/auth/2fa/action", {
    method: "POST",
    headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  })
}

function publicRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/2fa/verify-login", {
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  })
}

const userToken = signAccessToken({
  userId: baseUser.id,
  email: baseUser.email,
  firstName: baseUser.firstName,
  lastName: baseUser.lastName,
  role: baseUser.role,
})

describe("POST /api/auth/2fa/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(TWO_FACTOR_CONFIG as any)
  })

  it("génère un secret, le persiste (2FA toujours désactivée) et renvoie un QR code", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)

    const response = await setupTwoFactor(authedRequest({}, userToken))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.secret).toMatch(/^[A-Z2-7]+$/)
    expect(json.data.otpauthUri).toMatch(/^otpauth:\/\/totp\//)
    expect(json.data.qrCodeDataUrl).toContain("data:image/png")
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { twoFactorSecret: json.data.secret },
    })
  })

  it("refuse si la fonctionnalité est désactivée globalement (Configuration > Sécurité)", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue({
      config: { security: { twoFactor: { ...TWO_FACTOR_CONFIG.config.security.twoFactor, enabled: false } } },
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser } as any)

    const response = await setupTwoFactor(authedRequest({}, userToken))
    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("refuse si la 2FA est déjà activée", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, twoFactorEnabled: true } as any)

    const response = await setupTwoFactor(authedRequest({}, userToken))
    expect(response.status).toBe(400)
  })
})

describe("POST /api/auth/2fa/enable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(TWO_FACTOR_CONFIG as any)
  })

  it("active la 2FA avec un code valide et renvoie des codes de secours", async () => {
    const secret = "JBSWY3DPEHPK3PXP"
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, twoFactorSecret: secret } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)

    const code = generateTotp(secret, { digits: 6, period: 30, algorithm: "SHA1" })
    const response = await enableTwoFactor(authedRequest({ code }, userToken))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.backupCodes).toHaveLength(8)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseUser.id },
        data: expect.objectContaining({ twoFactorEnabled: true }),
      }),
    )
    expect(sendAuthMethodChangedEmailMock).toHaveBeenCalledWith(baseUser.email, baseUser.firstName, "2fa")
  })

  it("refuse un code incorrect et n'active pas la 2FA", async () => {
    const secret = "JBSWY3DPEHPK3PXP"
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, twoFactorSecret: secret } as any)

    const response = await enableTwoFactor(authedRequest({ code: "000000" }, userToken))
    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("refuse s'il n'y a pas de configuration 2FA en attente", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, twoFactorSecret: null } as any)

    const response = await enableTwoFactor(authedRequest({ code: "123456" }, userToken))
    expect(response.status).toBe(400)
  })
})

describe("POST /api/auth/2fa/disable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("désactive la 2FA avec le bon mot de passe", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      twoFactorEnabled: true,
      twoFactorSecret: "SECRET",
      twoFactorBackupCodes: ["hash1"],
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)

    const response = await disableTwoFactor(authedRequest({ password: "correct-password" }, userToken))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    })
    expect(sendAuthMethodChangedEmailMock).toHaveBeenCalledWith(baseUser.email, baseUser.firstName, "password")
  })

  it("refuse un mauvais mot de passe (401)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, twoFactorEnabled: true } as any)

    const response = await disableTwoFactor(authedRequest({ password: "wrong-password" }, userToken))
    expect(response.status).toBe(401)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})

describe("POST /api/auth/2fa/verify-login", () => {
  const secret = "JBSWY3DPEHPK3PXP"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(TWO_FACTOR_CONFIG as any)
  })

  it("délivre les tokens de session avec un code TOTP valide", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
    } as any)

    const tempToken = signTwoFactorPendingToken(baseUser.id)
    const code = generateTotp(secret, { digits: 6, period: 30, algorithm: "SHA1" })

    const response = await verifyLogin(publicRequest({ tempToken, code }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.accessToken).toBeTruthy()
    expect(json.data.refreshToken).toBeTruthy()
    expect(json.data.user.email).toBe(baseUser.email)
    expect(json.data.user).not.toHaveProperty("twoFactorSecret")
  })

  it("refuse un code TOTP incorrect (401)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
    } as any)

    const tempToken = signTwoFactorPendingToken(baseUser.id)
    const response = await verifyLogin(publicRequest({ tempToken, code: "000000" }))
    expect(response.status).toBe(401)
  })

  it("refuse un jeton temporaire invalide", async () => {
    const response = await verifyLogin(publicRequest({ tempToken: "bogus", code: "123456" }))
    expect(response.status).toBe(401)
  })

  it("accepte un code de secours valide et le consomme (usage unique)", async () => {
    const backupCode = "ABCDE-FGHIJ"
    const hashedBackupCode = await bcrypt.hash(backupCode, 4)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: [hashedBackupCode],
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)

    const tempToken = signTwoFactorPendingToken(baseUser.id)
    const response = await verifyLogin(publicRequest({ tempToken, code: backupCode }))

    expect(response.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { twoFactorBackupCodes: [] },
    })
  })
})
