import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  prisma: {
    appConfig: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/server-events", () => ({
  serverEvents: { emit: vi.fn() },
}))

const { prisma } = await import("@/lib/db")
const {
  createLowStockNotification,
  createMovementNotification,
  createUserActivityNotification,
} = await import("@/lib/notification-helper")

function configWith(notifications: Record<string, unknown>) {
  return { config: { notifications } }
}

const createdNotification = {
  id: "notif-1",
  type: "warning",
  title: "Stock faible",
  message: "x",
  userId: null,
  isRead: false,
  createdAt: new Date(),
}

describe("createLowStockNotification", () => {
  beforeEach(() => vi.clearAllMocks())

  it("crée la notification quand le canal in-app est activé (global et par type)", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ inAppNotifications: true, lowStockAlerts: { inApp: true, email: false } }) as any,
    )
    vi.mocked(prisma.notification.create).mockResolvedValue(createdNotification as any)

    const result = await createLowStockNotification("Visa Classique", 10, 50)

    expect(result).not.toBeNull()
    expect(prisma.notification.create).toHaveBeenCalled()
  })

  it("ne crée rien si l'interrupteur général in-app est désactivé", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ inAppNotifications: false, lowStockAlerts: { inApp: true, email: false } }) as any,
    )

    const result = await createLowStockNotification("Visa Classique", 10, 50)

    expect(result).toBeNull()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it("ne crée rien si le canal in-app est désactivé pour ce type précis", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ inAppNotifications: true, lowStockAlerts: { inApp: false, email: true } }) as any,
    )

    const result = await createLowStockNotification("Visa Classique", 10, 50)

    expect(result).toBeNull()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it("crée la notification si la configuration est illisible (comportement par défaut : actif)", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockRejectedValue(new Error("db down"))
    vi.mocked(prisma.notification.create).mockResolvedValue(createdNotification as any)

    const result = await createLowStockNotification("Visa Classique", 10, 50)

    expect(result).not.toBeNull()
  })
})

describe("createMovementNotification", () => {
  beforeEach(() => vi.clearAllMocks())

  it("respecte l'interrupteur in-app propre aux notifications de mouvement", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ inAppNotifications: true, movementNotifications: { inApp: false, email: true } }) as any,
    )

    const result = await createMovementNotification("entry", "Visa Classique", 10)

    expect(result).toBeNull()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it("crée la notification quand le canal in-app est activé", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ inAppNotifications: true, movementNotifications: { inApp: true, email: true } }) as any,
    )
    vi.mocked(prisma.notification.create).mockResolvedValue(createdNotification as any)

    const result = await createMovementNotification("entry", "Visa Classique", 10)

    expect(result).not.toBeNull()
  })
})

describe("createUserActivityNotification", () => {
  beforeEach(() => vi.clearAllMocks())

  it("respecte l'interrupteur in-app propre aux alertes d'activité utilisateur", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ inAppNotifications: true, userActivityAlerts: { inApp: false, email: true } }) as any,
    )

    const result = await createUserActivityNotification("Create users", "users", "jane@example.com")

    expect(result).toBeNull()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it("crée la notification quand le canal in-app est activé", async () => {
    vi.mocked(prisma.appConfig.findUnique).mockResolvedValue(
      configWith({ inAppNotifications: true, userActivityAlerts: { inApp: true, email: true } }) as any,
    )
    vi.mocked(prisma.notification.create).mockResolvedValue(createdNotification as any)

    const result = await createUserActivityNotification("Create users", "users", "jane@example.com")

    expect(result).not.toBeNull()
  })
})
