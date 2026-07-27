import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import * as bcrypt from "bcryptjs"
import { signPasswordResetToken } from "@/lib/auth"

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

const sendPasswordResetEmailMock = vi.fn().mockResolvedValue(true)
const sendPasswordChangedConfirmationEmailMock = vi.fn().mockResolvedValue(true)
vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: sendPasswordResetEmailMock,
  sendPasswordChangedConfirmationEmail: sendPasswordChangedConfirmationEmailMock,
}))

const { prisma } = await import("@/lib/db")
const { POST: forgotPassword } = await import("@/app/api/auth/forgot-password/route")
const { POST: resetPassword } = await import("@/app/api/auth/reset-password/route")

const originalPassword = bcrypt.hashSync("old-password", 4)

const baseUser = {
  id: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  isActive: true,
  password: originalPassword,
  failedLoginAttempts: 2,
  lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
}

let requestCounter = 0

function forgotPasswordRequest(email: string) {
  requestCounter += 1
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: new Headers({ "content-type": "application/json", "x-forwarded-for": `10.3.0.${requestCounter}` }),
    body: JSON.stringify({ email }),
  })
}

function resetPasswordRequest(body: unknown) {
  requestCounter += 1
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: new Headers({ "content-type": "application/json", "x-forwarded-for": `10.4.0.${requestCounter}` }),
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie un message générique et envoie un email quand le compte existe", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser } as any)

    const response = await forgotPassword(forgotPasswordRequest(baseUser.email))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
      baseUser.email,
      baseUser.firstName,
      expect.stringContaining("/reset-password?token="),
    )
  })

  it("renvoie le même message générique sans envoyer d'email quand le compte n'existe pas (anti-énumération)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const response = await forgotPassword(forgotPasswordRequest("inconnu@example.com"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled()
  })

  it("refuse une requête sans email (400)", async () => {
    const response = await forgotPassword(forgotPasswordRequest(""))
    expect(response.status).toBe(400)
  })
})

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse un mot de passe trop court (400)", async () => {
    const token = signPasswordResetToken(baseUser.id, baseUser.password)
    const response = await resetPassword(resetPasswordRequest({ token, newPassword: "123" }))
    expect(response.status).toBe(400)
  })

  it("refuse un jeton invalide (401)", async () => {
    const response = await resetPassword(resetPasswordRequest({ token: "bogus", newPassword: "nouveau-mdp" }))
    expect(response.status).toBe(401)
  })

  it("réinitialise le mot de passe avec un jeton valide, lève le verrouillage, et journalise l'action", async () => {
    const token = signPasswordResetToken(baseUser.id, baseUser.password)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...baseUser } as any)

    const response = await resetPassword(resetPasswordRequest({ token, newPassword: "nouveau-mot-de-passe" }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null, password: expect.any(String) }),
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: baseUser.id, action: "update", module: "users" }),
      }),
    )
    expect(sendPasswordChangedConfirmationEmailMock).toHaveBeenCalledWith(baseUser.email, baseUser.firstName)
  })

  it("refuse un jeton déjà utilisé (le mot de passe a changé depuis son émission)", async () => {
    const token = signPasswordResetToken(baseUser.id, baseUser.password)
    // Le mot de passe en base a déjà changé (ex: une première réinitialisation
    // a déjà consommé ce jeton) : l'empreinte ne correspond plus.
    const changedPassword = bcrypt.hashSync("un-autre-mot-de-passe", 4)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, password: changedPassword } as any)

    const response = await resetPassword(resetPasswordRequest({ token, newPassword: "nouveau-mot-de-passe" }))
    expect(response.status).toBe(401)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
