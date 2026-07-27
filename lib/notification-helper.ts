// Helper pour créer des notifications automatiques
import { prisma } from "@/lib/db"
import type { Notification } from "@/lib/types"
import { serverEvents } from "@/lib/server-events"
import { normalizeNotificationSettings } from "@/lib/notification-settings"

type NotificationCategory = "lowStockAlerts" | "movementNotifications" | "userActivityAlerts"

// Vérifie, pour un type de notification donné, si le canal in-app est activé
// (à la fois l'interrupteur général et celui spécifique au type). En cas
// d'erreur de lecture de la configuration, on n'empêche pas la création de la
// notification (comportement historique avant l'ajout de ce filtre).
async function isInAppEnabledFor(category: NotificationCategory): Promise<boolean> {
  try {
    const config = await prisma.appConfig.findUnique({ where: { id: "singleton" } })
    const notifications = normalizeNotificationSettings((config?.config as any)?.notifications)
    return notifications.inAppNotifications && notifications[category].inApp
  } catch (error) {
    console.error("Error checking in-app notification settings:", error)
    return true
  }
}

export async function createNotification(data: {
  type: "info" | "warning" | "error" | "success"
  title: string
  message: string
  userId?: string | null
}): Promise<Notification | null> {
  try {
    const notification = await prisma.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        userId: data.userId || null,
        isRead: false,
      }
    })
    // Pousse la notification en temps réel (SSE) aux clients connectés, en plus
    // de la persister pour les clients qui la récupéreront via /api/notifications.
    serverEvents.emit("notification", notification)
    return notification as Notification
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

export async function createLowStockNotification(cardName: string, currentStock: number, threshold: number, userId?: string) {
  if (!(await isInAppEnabledFor("lowStockAlerts"))) return null
  return createNotification({
    type: "warning",
    title: "Stock faible",
    message: `Le stock de ${cardName} est faible (${currentStock} unités). Seuil: ${threshold}`,
    userId
  })
}

export async function createMovementNotification(movementType: string, cardName: string, quantity: number, userId?: string) {
  if (!(await isInAppEnabledFor("movementNotifications"))) return null
  const typeLabels = {
    entry: "Entrée",
    exit: "Sortie",
    transfer: "Transfert"
  }

  return createNotification({
    type: "info",
    title: "Nouveau mouvement",
    message: `${typeLabels[movementType as keyof typeof typeLabels] || movementType} de ${quantity} ${cardName}`,
    userId
  })
}

export async function createUserActivityNotification(action: string, entityType: string, entityName: string, userId?: string) {
  if (!(await isInAppEnabledFor("userActivityAlerts"))) return null
  return createNotification({
    type: "info",
    title: "Activité utilisateur",
    message: `${action} de ${entityType}: ${entityName}`,
    userId
  })
}

export async function createSystemNotification(title: string, message: string) {
  return createNotification({
    type: "info",
    title,
    message,
    userId: null // Notification globale
  })
}
