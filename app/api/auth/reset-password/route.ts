import { type NextRequest, NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { verifyPasswordResetToken, fingerprintPassword } from "@/lib/auth"
import { passwordResetRateLimiter } from "@/lib/rate-limiter"
import { logAudit } from "@/lib/audit-logger"
import { logger } from "@/lib/logger"
import { sendPasswordChangedConfirmationEmail } from "@/lib/email-service"

// POST /api/auth/reset-password - Confirme la réinitialisation d'un mot de
// passe avec le jeton reçu par email. Réinitialise également le compteur de
// tentatives échouées et lève un éventuel verrouillage en cours : c'est l'un
// des deux moyens de débloquer un compte verrouillé (l'autre étant d'attendre
// la fin du compte à rebours).

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const rateLimitResponse = passwordResetRateLimiter(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const token = typeof body.token === "string" ? body.token : ""
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

    if (!token || !newPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Jeton et nouveau mot de passe requis" },
        { status: 400 },
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Le mot de passe doit contenir au moins 6 caractères" },
        { status: 400 },
      )
    }

    let payload
    try {
      payload = verifyPasswordResetToken(token)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lien invalide"
      return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Compte introuvable" }, { status: 401 })
    }

    // Le mot de passe a changé depuis l'émission du lien (autre réinitialisation
    // entre-temps, ou changement manuel) : ce lien est donc déjà consommé/périmé.
    if (fingerprintPassword(user.password) !== payload.passwordFingerprint) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Ce lien de réinitialisation a déjà été utilisé ou n'est plus valide" },
        { status: 401 },
      )
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    })

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "update",
      module: "users",
      entityType: "user",
      entityId: user.id,
      entityName: `${user.firstName} ${user.lastName}`,
      details: `Réinitialisation du mot de passe de ${user.email} via le lien "mot de passe oublié"`,
      status: "success",
    }, request)

    try {
      await sendPasswordChangedConfirmationEmail(user.email, user.firstName)
    } catch (emailError) {
      logger.error("Error sending password changed confirmation email", emailError)
      // On ne fait jamais échouer la réinitialisation à cause d'un email non envoyé.
    }

    return NextResponse.json<ApiResponse>({ success: true, message: "Mot de passe réinitialisé avec succès" })
  } catch (error) {
    logger.error("Reset password error", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la réinitialisation du mot de passe" },
      { status: 500 },
    )
  }
}
