import { beforeEach, describe, expect, it, vi } from "vitest"

// lib/email-service.ts importe "server-only", qui lève une erreur dès son
// import hors d'un Server Component (donc systématiquement sous Vitest).
vi.mock("server-only", () => ({}))

vi.mock("@/lib/db", () => ({
  prisma: {
    appConfig: {
      findUnique: vi.fn(),
    },
  },
}))

const sendMailMock = vi.fn().mockResolvedValue(undefined)
vi.mock("nodemailer", () => ({
  createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
}))

const { prisma } = await import("@/lib/db")
const {
  sendUserWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedConfirmationEmail,
  sendAuthMethodChangedEmail,
} = await import("@/lib/email-service")

const smtp = {
  host: "smtp.example.com",
  port: 587,
  secure: false,
  username: "user",
  password: "pass",
  fromEmail: "noreply@example.com",
  fromName: "Plateforme",
}

function configWith(notifications: Record<string, unknown>) {
  return { config: { smtp, notifications } }
}

describe("sendUserWelcomeEmail", () => {
  beforeEach(() => vi.clearAllMocks())

  it("n'envoie rien si l'interrupteur général email est désactivé", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ emailNotifications: false, accountEmails: { welcomeEmail: true } }) as any,
    )
    const result = await sendUserWelcomeEmail("jane@example.com", "Jane", "Doe", "temp-pass", "user")
    expect(result).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("n'envoie rien si l'email de bienvenue est désactivé individuellement", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ emailNotifications: true, accountEmails: { welcomeEmail: false } }) as any,
    )
    const result = await sendUserWelcomeEmail("jane@example.com", "Jane", "Doe", "temp-pass", "user")
    expect(result).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("envoie l'email quand les deux interrupteurs sont activés", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ emailNotifications: true, accountEmails: { welcomeEmail: true } }) as any,
    )
    const result = await sendUserWelcomeEmail("jane@example.com", "Jane", "Doe", "temp-pass", "user")
    expect(result).toBe(true)
    expect(sendMailMock).toHaveBeenCalled()
  })
})

describe("sendPasswordResetEmail", () => {
  beforeEach(() => vi.clearAllMocks())

  it("respecte son propre interrupteur", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ accountEmails: { passwordResetEmail: false } }) as any,
    )
    const result = await sendPasswordResetEmail("jane@example.com", "Jane", "https://x/reset?token=abc")
    expect(result).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("ignore l'interrupteur général email : c'est un email de sécurité critique", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ emailNotifications: false, accountEmails: { passwordResetEmail: true } }) as any,
    )
    const result = await sendPasswordResetEmail("jane@example.com", "Jane", "https://x/reset?token=abc")
    expect(result).toBe(true)
    expect(sendMailMock).toHaveBeenCalled()
  })
})

describe("sendPasswordChangedConfirmationEmail", () => {
  beforeEach(() => vi.clearAllMocks())

  it("respecte son propre interrupteur", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ accountEmails: { passwordChangedEmail: false } }) as any,
    )
    const result = await sendPasswordChangedConfirmationEmail("jane@example.com", "Jane")
    expect(result).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("ignore l'interrupteur général email : c'est un email de sécurité critique", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ emailNotifications: false, accountEmails: { passwordChangedEmail: true } }) as any,
    )
    const result = await sendPasswordChangedConfirmationEmail("jane@example.com", "Jane")
    expect(result).toBe(true)
    expect(sendMailMock).toHaveBeenCalled()
  })
})

describe("sendAuthMethodChangedEmail", () => {
  beforeEach(() => vi.clearAllMocks())

  it("respecte son propre interrupteur", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ accountEmails: { authMethodChangedEmail: false } }) as any,
    )
    const result = await sendAuthMethodChangedEmail("jane@example.com", "Jane", "2fa")
    expect(result).toBe(false)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it("ignore l'interrupteur général email : c'est un email de sécurité critique", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ emailNotifications: false, accountEmails: { authMethodChangedEmail: true } }) as any,
    )
    const result = await sendAuthMethodChangedEmail("jane@example.com", "Jane", "2fa")
    expect(result).toBe(true)
    expect(sendMailMock).toHaveBeenCalled()
  })
})
