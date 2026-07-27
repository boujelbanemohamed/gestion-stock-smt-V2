import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { requireAdmin } from "@/lib/auth-middleware"
import { sanitizeUser } from "@/lib/sanitize-user"
import { logAudit } from "@/lib/audit-logger"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/users/[id]/two-factor/reset - Réinitialise la configuration 2FA
// d'un utilisateur (secret + codes de secours effacés), par exemple lorsqu'il
// a perdu l'accès à son application d'authentification. Réservé au super
// admin. L'exigence de 2FA (si active) est conservée : l'utilisateur devra
// simplement reconfigurer un nouvel authenticator à sa prochaine connexion.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Utilisateur non trouvé" }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { twoFactorSecret: null, twoFactorBackupCodes: [] },
    })

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: "update",
      module: "users",
      entityType: "user",
      entityId: updatedUser.id,
      entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
      details: `Réinitialisation de la configuration 2FA de ${updatedUser.email} par ${auth.user.email}`,
      status: "success",
    }, request)

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: sanitizeUser(updatedUser) as User,
      message: "Configuration 2FA réinitialisée",
    })
  } catch (error) {
    console.error('Error resetting two-factor config:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la réinitialisation de la configuration 2FA" },
      { status: 500 },
    )
  }
}
