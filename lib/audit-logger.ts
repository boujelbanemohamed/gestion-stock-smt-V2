import { prisma } from "@/lib/db"
import { type NextRequest } from "next/server"

export interface LogEntry {
  userId: string
  userEmail: string
  // « login_failed » est déjà écrit par la route de connexion et par la
  // vérification 2FA : sans lui dans cette union, `tsc --noEmit` échoue.
  action: "create" | "update" | "delete" | "login" | "login_failed" | "logout" | "view"
  module: "banks" | "cards" | "locations" | "movements" | "users" | "config" | "roles" | "auth"
  entityType: string
  entityId?: string
  entityName?: string
  details: string
  status: "success" | "failure"
  errorMessage?: string
}

/**
 * Enregistre une action dans les logs d'audit
 */
export async function logAudit(
  entry: LogEntry,
  request?: NextRequest
): Promise<void> {
  try {
    // Extraire l'IP et le User-Agent de la requête
    const ipAddress = request?.headers.get("x-forwarded-for") || 
                      request?.headers.get("x-real-ip") || 
                      "unknown"
    
    const userAgent = request?.headers.get("user-agent") || "unknown"

    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        userEmail: entry.userEmail,
        action: entry.action,
        module: entry.module,
        entityType: entry.entityType,
        entityId: entry.entityId || null,
        entityName: entry.entityName || null,
        details: entry.details,
        ipAddress,
        userAgent,
        status: entry.status,
        errorMessage: entry.errorMessage || null,
      },
    })

    // Envoyer notification email pour les activités importantes
    if (entry.status === "success") {
      const importantActions = ["delete", "create"]
      const importantModules = ["users", "config", "roles"]
      
      if (importantActions.includes(entry.action) && importantModules.includes(entry.module)) {
        const activityType = `${entry.action.charAt(0).toUpperCase() + entry.action.slice(1)} ${entry.module}`
        const userName = entry.userEmail.split("@")[0] // Utiliser l'email comme nom si pas disponible

        try {
          const { sendUserActivityAlert } = await import("@/lib/email-service")
          await sendUserActivityAlert(
            activityType,
            userName,
            entry.userEmail,
            entry.details
          )
        } catch (emailError) {
          console.error("Erreur lors de l'envoi de l'alerte email:", emailError)
          // On continue même si l'email échoue
        }

        try {
          const { createUserActivityNotification } = await import("@/lib/notification-helper")
          await createUserActivityNotification(activityType, entry.module, entry.entityName || entry.entityType)
        } catch (notifError) {
          console.error("Erreur lors de la création de la notification in-app:", notifError)
          // On continue même si la notification échoue
        }
      }
    }
  } catch (error) {
    // En cas d'erreur de logging, on ne bloque pas l'opération principale
    console.error("Error logging audit entry:", error)
  }
}

/**
 * Helper pour extraire l'utilisateur courant du localStorage (côté client)
 * Côté serveur, on doit passer ces infos explicitement
 */
export function getUserFromSession(): { userId: string; userEmail: string } | null {
  if (typeof window === 'undefined') {
    // Côté serveur, retourner null
    return null
  }
  
  try {
    const userStr = localStorage.getItem('currentUser')
    if (!userStr) return null
    
    const user = JSON.parse(userStr)
    return {
      userId: user.id,
      userEmail: user.email
    }
  } catch {
    return null
  }
}

