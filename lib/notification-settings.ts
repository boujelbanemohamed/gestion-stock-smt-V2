import type { AccountEmailSettings, NotificationChannelToggle, NotificationSettings } from "@/lib/types"

const DEFAULT_TOGGLE: NotificationChannelToggle = { inApp: true, email: true }

const DEFAULT_ACCOUNT_EMAILS: AccountEmailSettings = {
  welcomeEmail: true,
  passwordResetEmail: true,
  passwordChangedEmail: true,
  authMethodChangedEmail: true,
}

function normalizeAccountEmails(value: unknown): AccountEmailSettings {
  if (value && typeof value === "object") {
    const v = value as Partial<AccountEmailSettings>
    return {
      welcomeEmail: v.welcomeEmail ?? DEFAULT_ACCOUNT_EMAILS.welcomeEmail,
      passwordResetEmail: v.passwordResetEmail ?? DEFAULT_ACCOUNT_EMAILS.passwordResetEmail,
      passwordChangedEmail: v.passwordChangedEmail ?? DEFAULT_ACCOUNT_EMAILS.passwordChangedEmail,
      authMethodChangedEmail: v.authMethodChangedEmail ?? DEFAULT_ACCOUNT_EMAILS.authMethodChangedEmail,
    }
  }
  return DEFAULT_ACCOUNT_EMAILS
}

function normalizeChannelToggle(value: unknown): NotificationChannelToggle {
  // Anciennes configurations : un simple booléen ne gérait que le canal email
  // (le canal in-app n'était alors soumis à aucun filtre, donc toujours actif).
  if (typeof value === "boolean") {
    return { inApp: true, email: value }
  }
  if (value && typeof value === "object") {
    const v = value as Partial<NotificationChannelToggle>
    return {
      inApp: v.inApp ?? DEFAULT_TOGGLE.inApp,
      email: v.email ?? DEFAULT_TOGGLE.email,
    }
  }
  return DEFAULT_TOGGLE
}

/**
 * Ramène la configuration des notifications (potentiellement dans l'ancien
 * format, un booléen par type) vers le format actuel avec un interrupteur
 * indépendant par canal (in-app / email) et par type de notification.
 */
export function normalizeNotificationSettings(raw: any): NotificationSettings {
  return {
    enabled: raw?.enabled ?? true,
    lowStockAlerts: normalizeChannelToggle(raw?.lowStockAlerts),
    movementNotifications: normalizeChannelToggle(raw?.movementNotifications),
    userActivityAlerts: normalizeChannelToggle(raw?.userActivityAlerts),
    accountEmails: normalizeAccountEmails(raw?.accountEmails),
    lowStockThreshold: raw?.lowStockThreshold ?? 100,
    criticalStockThreshold: raw?.criticalStockThreshold ?? 50,
    emailNotifications: raw?.emailNotifications ?? false,
    inAppNotifications: raw?.inAppNotifications ?? true,
    emailRecipients: raw?.emailRecipients ?? [],
  }
}
