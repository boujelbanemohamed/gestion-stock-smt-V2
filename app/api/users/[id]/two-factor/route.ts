import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { requireAdmin } from "@/lib/auth-middleware"
import { sanitizeUser } from "@/lib/sanitize-user"
import { logAudit } from "@/lib/audit-logger"
import { sendAuthMethodChangedEmail } from "@/lib/email-service"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PATCH /api/users/[id]/two-factor - Change le type d'authentification requis
// pour un utilisateur (mot de passe seul <-> mot de passe + 2FA). Réservé au
// super admin. Ne touche jamais au secret TOTP déjà configuré : désactiver
// l'exigence de 2FA la met simplement en pause, elle peut être réactivée sans
// que l'utilisateur ait à reconfigurer son application d'authentification.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Le champ 'enabled' (booléen) est requis" },
        { status: 400 },
      )
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Utilisateur non trouvé" }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { twoFactorEnabled: body.enabled },
    })

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: "update",
      module: "users",
      entityType: "user",
      entityId: updatedUser.id,
      entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
      details: `Type d'authentification de ${updatedUser.email} changé vers "${body.enabled ? "Mot de passe + 2FA" : "Mot de passe seul"}" par ${auth.user.email}`,
      status: "success",
    }, request)

    // On ne prévient l'utilisateur immédiatement que si le changement est
    // réellement effectif dès maintenant : soit la 2FA est désactivée (effet
    // immédiat), soit elle est réactivée pour un compte qui a déjà un
    // authenticator configuré (pas de configuration à refaire). Si la 2FA
    // vient d'être exigée pour un compte qui ne l'a jamais configurée,
    // /api/auth/2fa/enable-login enverra l'email une fois la configuration
    // effectivement terminée.
    const isEffectiveNow = !body.enabled || Boolean(updatedUser.twoFactorSecret)
    if (isEffectiveNow) {
      try {
        await sendAuthMethodChangedEmail(updatedUser.email, updatedUser.firstName, body.enabled ? "2fa" : "password")
      } catch (emailError) {
        console.error('Error sending auth method changed email:', emailError)
      }
    }

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: sanitizeUser(updatedUser) as User,
      message: "Type d'authentification mis à jour",
    })
  } catch (error) {
    console.error('Error updating two-factor requirement:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la mise à jour du type d'authentification" },
      { status: 500 },
    )
  }
}
