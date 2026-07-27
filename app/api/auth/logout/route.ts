import { type NextRequest, NextResponse } from "next/server"
import type { ApiResponse } from "@/lib/api-types"
import { verifyAuth } from "@/lib/auth-middleware"
import { logAudit } from "@/lib/audit-logger"

// POST /api/auth/logout - Déconnexion

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Le jeton peut être expiré au moment de la déconnexion : on essaie de
    // journaliser qui se déconnecte, mais ça ne doit jamais empêcher la
    // déconnexion elle-même de réussir côté client.
    try {
      const user = verifyAuth(request)
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        action: "logout",
        module: "auth",
        entityType: "user",
        entityId: user.id,
        entityName: `${user.firstName} ${user.lastName}`,
        details: `Déconnexion de ${user.email}`,
        status: "success",
      }, request)
    } catch {
      // Pas de token valide : rien à journaliser.
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Déconnexion réussie",
    })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la déconnexion",
      },
      { status: 500 },
    )
  }
}