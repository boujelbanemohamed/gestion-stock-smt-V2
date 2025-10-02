// Helper pour créer des notifications automatiques
import { prisma } from "@/lib/db"
import type { Notification } from "@/lib/types"

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
    return notification as Notification
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

export async function createLowStockNotification(cardName: string, currentStock: number, threshold: number, userId?: string) {
  return createNotification({
    type: "warning",
    title: "Stock faible",
    message: `Le stock de ${cardName} est faible (${currentStock} unités). Seuil: ${threshold}`,
    userId
  })
}

export async function createMovementNotification(movementType: string, cardName: string, quantity: number, userId?: string) {
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
