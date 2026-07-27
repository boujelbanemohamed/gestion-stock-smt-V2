import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import * as bcrypt from "bcryptjs"
import { verifyTwoFactorPendingToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/security-config", () => ({
  getLoginSecuritySettings: vi.fn().mockResolvedValue({ maxLoginAttempts: 3, lockoutDuration: 30 }),
}))

const { prisma } = await import("@/lib/db")
const { POST: login } = await import("@/app/api/auth/login/route")

const hashedPassword = bcrypt.hashSync("correct-password", 4)

const baseUser = {
  id: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  isActive: true,
  password: hashedPassword,
  twoFactorEnabled: false,
  twoFactorSecret: null as string | null,
  failedLoginAttempts: 0,
  lockedUntil: null as Date | null,
}

// Chaque test utilise une IP distincte : le rate limiter de connexion (5
// tentatives / 15 min) partage sinon la même clé ("login:unknown") entre tous
// les tests de ce fichier et finirait par renvoyer 429 au lieu du code attendu.
let requestCounter = 0

function loginRequest(email: string, password: string) {
  requestCounter += 1
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: new Headers({ "content-type": "application/json", "x-forwarded-for": `10.1.0.${requestCounter}` }),
    body: JSON.stringify({ email, password }),
  })
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("délivre directement les tokens si la 2FA n'est pas activée, et journalise la connexion", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser } as any)

    const response = await login(loginRequest(baseUser.email, "correct-password"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.accessToken).toBeTruthy()
    expect(json.data.refreshToken).toBeTruthy()
    expect(json.data.user.email).toBe(baseUser.email)
    expect(json.data.requiresTwoFactor).toBeUndefined()

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: baseUser.id, action: "login", status: "success" }),
      }),
    )
  })

  it("journalise un échec de connexion (login_failed) si l'utilisateur n'existe pas", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const response = await login(loginRequest("inconnu@example.com", "whatever"))
    expect(response.status).toBe(401)

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userEmail: "inconnu@example.com", action: "login_failed", status: "failure" }),
      }),
    )
  })

  it("journalise un échec de connexion si le compte est désactivé, et le signale distinctement au client", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, isActive: false } as any)

    const response = await login(loginRequest(baseUser.email, "correct-password"))
    const json = await response.json()
    expect(response.status).toBe(403)
    expect(json.data.accountDisabled).toBe(true)

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: baseUser.id, action: "login_failed", status: "failure" }),
      }),
    )
  })

  it("ne délivre pas de tokens et renvoie un jeton temporaire si la 2FA est activée et déjà configurée", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, twoFactorEnabled: true, twoFactorSecret: "JBSWY3DPEHPK3PXP" } as any)

    const response = await login(loginRequest(baseUser.email, "correct-password"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.requiresTwoFactor).toBe(true)
    expect(json.data.requiresTwoFactorSetup).toBeUndefined()
    expect(json.data.accessToken).toBeUndefined()
    expect(json.data.refreshToken).toBeUndefined()
    expect(json.data.user).toBeUndefined()

    // Le jeton temporaire doit bien identifier cet utilisateur et rien de plus.
    const decoded = verifyTwoFactorPendingToken(json.data.tempToken)
    expect(decoded.userId).toBe(baseUser.id)
  })

  it("force la configuration de la 2FA si elle est exigée mais jamais configurée (secret absent)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, twoFactorEnabled: true, twoFactorSecret: null } as any)

    const response = await login(loginRequest(baseUser.email, "correct-password"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.requiresTwoFactorSetup).toBe(true)
    expect(json.data.requiresTwoFactor).toBeUndefined()
    expect(json.data.accessToken).toBeUndefined()

    const decoded = verifyTwoFactorPendingToken(json.data.tempToken)
    expect(decoded.userId).toBe(baseUser.id)
  })

  it("refuse un mauvais mot de passe avant même de considérer la 2FA (401), et journalise l'échec", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, twoFactorEnabled: true } as any)

    const response = await login(loginRequest(baseUser.email, "wrong-password"))
    expect(response.status).toBe(401)

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: baseUser.id, action: "login_failed", status: "failure" }),
      }),
    )
  })

  it("incrémente le compteur d'échecs sans verrouiller tant que le seuil n'est pas atteint (maxLoginAttempts=3)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, failedLoginAttempts: 1 } as any)

    const response = await login(loginRequest(baseUser.email, "wrong-password"))
    expect(response.status).toBe(401)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { failedLoginAttempts: 2 },
    })
  })

  it("verrouille le compte au Nème échec (maxLoginAttempts=3) et renvoie le compte à rebours", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, failedLoginAttempts: 2 } as any)

    const response = await login(loginRequest(baseUser.email, "wrong-password"))
    const json = await response.json()

    expect(response.status).toBe(423)
    expect(json.data.locked).toBe(true)
    expect(new Date(json.data.lockedUntil).getTime()).toBeGreaterThan(Date.now())

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { failedLoginAttempts: 3, lockedUntil: expect.any(Date) },
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: baseUser.id, action: "login_failed", status: "failure" }),
      }),
    )
  })

  it("refuse toute tentative (même avec le bon mot de passe) tant que le compte est verrouillé", async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, lockedUntil } as any)

    const response = await login(loginRequest(baseUser.email, "correct-password"))
    const json = await response.json()

    expect(response.status).toBe(423)
    expect(json.data.locked).toBe(true)
    expect(json.data.lockedUntil).toBe(lockedUntil.toISOString())
    // Le mot de passe ne doit même pas être vérifié : aucune mise à jour du compteur.
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("autorise à nouveau la connexion une fois le verrouillage expiré, et journalise le succès", async () => {
    const lockedUntil = new Date(Date.now() - 60 * 1000) // déjà expiré
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, failedLoginAttempts: 3, lockedUntil } as any)

    const response = await login(loginRequest(baseUser.email, "correct-password"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.accessToken).toBeTruthy()
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
  })
})
