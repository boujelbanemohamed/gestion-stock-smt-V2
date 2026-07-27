import { describe, expect, it } from "vitest"
import { normalizeNotificationSettings } from "@/lib/notification-settings"

describe("normalizeNotificationSettings", () => {
  it("relève les anciennes configurations (booléen unique par type) vers le nouveau format", () => {
    const result = normalizeNotificationSettings({
      enabled: true,
      lowStockAlerts: false,
      movementNotifications: true,
      userActivityAlerts: true,
      emailNotifications: true,
      inAppNotifications: true,
      emailRecipients: ["admin@example.com"],
      lowStockThreshold: 100,
      criticalStockThreshold: 50,
    })

    // Un booléen ne filtrait historiquement que le canal email ; l'in-app
    // n'était soumis à aucun filtre et doit donc rester actif après migration.
    expect(result.lowStockAlerts).toEqual({ inApp: true, email: false })
    expect(result.movementNotifications).toEqual({ inApp: true, email: true })
    expect(result.userActivityAlerts).toEqual({ inApp: true, email: true })
  })

  it("conserve le nouveau format (objet inApp/email) tel quel", () => {
    const result = normalizeNotificationSettings({
      lowStockAlerts: { inApp: false, email: true },
      movementNotifications: { inApp: true, email: false },
      userActivityAlerts: { inApp: false, email: false },
    })

    expect(result.lowStockAlerts).toEqual({ inApp: false, email: true })
    expect(result.movementNotifications).toEqual({ inApp: true, email: false })
    expect(result.userActivityAlerts).toEqual({ inApp: false, email: false })
  })

  it("applique des valeurs par défaut sûres quand la configuration est absente", () => {
    const result = normalizeNotificationSettings(undefined)

    expect(result.enabled).toBe(true)
    expect(result.lowStockAlerts).toEqual({ inApp: true, email: true })
    expect(result.emailNotifications).toBe(false)
    expect(result.inAppNotifications).toBe(true)
    expect(result.emailRecipients).toEqual([])
    expect(result.accountEmails).toEqual({
      welcomeEmail: true,
      passwordResetEmail: true,
      passwordChangedEmail: true,
      authMethodChangedEmail: true,
    })
  })

  it("complète un objet partiel avec les valeurs par défaut", () => {
    const result = normalizeNotificationSettings({
      lowStockAlerts: { email: false },
    })

    expect(result.lowStockAlerts).toEqual({ inApp: true, email: false })
  })

  it("conserve les interrupteurs individuels des emails de compte", () => {
    const result = normalizeNotificationSettings({
      accountEmails: {
        welcomeEmail: false,
        passwordResetEmail: true,
        passwordChangedEmail: false,
        authMethodChangedEmail: true,
      },
    })

    expect(result.accountEmails).toEqual({
      welcomeEmail: false,
      passwordResetEmail: true,
      passwordChangedEmail: false,
      authMethodChangedEmail: true,
    })
  })

  it("complète un objet accountEmails partiel avec les valeurs par défaut", () => {
    const result = normalizeNotificationSettings({
      accountEmails: { passwordResetEmail: false },
    })

    expect(result.accountEmails).toEqual({
      welcomeEmail: true,
      passwordResetEmail: false,
      passwordChangedEmail: true,
      authMethodChangedEmail: true,
    })
  })
})
