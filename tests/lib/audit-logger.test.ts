import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LogEntry } from "@/lib/audit-logger"

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

const sendUserActivityAlertMock = vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: sendUserActivityAlertMock,
}))

const createUserActivityNotificationMock = vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/notification-helper", () => ({
  createUserActivityNotification: createUserActivityNotificationMock,
}))

const { logAudit } = await import("@/lib/audit-logger")

function entry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    userId: "admin-1",
    userEmail: "admin@example.com",
    action: "create",
    module: "users",
    entityType: "user",
    entityName: "Jane Doe",
    details: "Création de l'utilisateur Jane Doe",
    status: "success",
    ...overrides,
  }
}

describe("logAudit - alerte d'activité utilisateur (email + in-app)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("notifie (email et in-app) pour une création sur un module sensible", async () => {
    await logAudit(entry({ action: "create", module: "users" }))

    expect(sendUserActivityAlertMock).toHaveBeenCalledWith(
      "Create users",
      "admin",
      "admin@example.com",
      "Création de l'utilisateur Jane Doe",
    )
    expect(createUserActivityNotificationMock).toHaveBeenCalledWith("Create users", "users", "Jane Doe")
  })

  it("notifie pour une suppression sur un module sensible", async () => {
    await logAudit(entry({ action: "delete", module: "roles" }))

    expect(sendUserActivityAlertMock).toHaveBeenCalled()
    expect(createUserActivityNotificationMock).toHaveBeenCalled()
  })

  it("ne notifie pas pour un module non sensible", async () => {
    await logAudit(entry({ action: "create", module: "cards" }))

    expect(sendUserActivityAlertMock).not.toHaveBeenCalled()
    expect(createUserActivityNotificationMock).not.toHaveBeenCalled()
  })

  it("ne notifie pas pour une simple mise à jour (action non sensible)", async () => {
    await logAudit(entry({ action: "update", module: "users" }))

    expect(sendUserActivityAlertMock).not.toHaveBeenCalled()
    expect(createUserActivityNotificationMock).not.toHaveBeenCalled()
  })

  it("ne notifie pas en cas d'échec de l'action journalisée", async () => {
    await logAudit(entry({ action: "create", module: "users", status: "failure" }))

    expect(sendUserActivityAlertMock).not.toHaveBeenCalled()
    expect(createUserActivityNotificationMock).not.toHaveBeenCalled()
  })
})
