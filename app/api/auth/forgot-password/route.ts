import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { signPasswordResetToken } from "@/lib/auth"
import { sendPasswordResetEmail } from "@/lib/email-service"
import { passwordResetRateLimiter } from "@/lib/rate-limiter"
import { getServerApiUrl } from "@/lib/env"
import { logger } from "@/lib/logger"

// POST /api/auth/forgot-password - Demande un lien de réinitialisation de mot
// de passe par email. Répond toujours avec le même message générique, que le
// compte existe ou non (et qu'il soit actif ou non), pour ne jamais révéler
// si une adresse email est enregistrée sur la plateforme.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GENERIC_MESSAGE = "Si un compte existe avec cette adresse email, un lien de réinitialisation vient de lui être envoyé."

export async function POST(request: NextRequest) {
  const rateLimitResponse = passwordResetRateLimiter(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const email = typeof body.email === "string" ? body.email.trim() : ""

    if (!email) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Email requis" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (user) {
      const token = signPasswordResetToken(user.id, user.password)
      const resetUrl = `${getServerApiUrl()}/reset-password?token=${encodeURIComponent(token)}`

      try {
        await sendPasswordResetEmail(user.email, user.firstName, resetUrl)
      } catch (emailError) {
        logger.error("Error sending password reset email", emailError)
        // On ne révèle jamais un échec d'envoi au client : même message générique.
      }
    }

    return NextResponse.json<ApiResponse>({ success: true, message: GENERIC_MESSAGE })
  } catch (error) {
    logger.error("Forgot password error", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la demande de réinitialisation" },
      { status: 500 },
    )
  }
}
