import { type NextRequest, NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { signAccessToken, signRefreshToken, verifyTwoFactorPendingToken } from "@/lib/auth"
import { verifyTotp } from "@/lib/totp"
import { getTwoFactorSettings } from "@/lib/two-factor-config"
import { sanitizeUser } from "@/lib/sanitize-user"
import { twoFactorRateLimiter } from "@/lib/rate-limiter"
import { logger } from "@/lib/logger"

// POST /api/auth/2fa/verify-login - Deuxième étape de connexion : vérifie le
// code TOTP (ou un code de secours) associé au jeton temporaire émis par
// /api/auth/login, puis délivre les vrais tokens de session.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const rateLimitResponse = twoFactorRateLimiter(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const tempToken = typeof body.tempToken === "string" ? body.tempToken : ""
    const code = typeof body.code === "string" ? body.code.trim() : ""

    if (!tempToken || !code) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Jeton temporaire et code requis" },
        { status: 400 },
      )
    }

    let userId: string
    try {
      userId = verifyTwoFactorPendingToken(tempToken).userId
    } catch (error) {
      const message = error instanceof Error ? error.message : "Jeton invalide"
      return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.isActive) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Compte introuvable ou désactivé" }, { status: 401 })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "La double authentification n'est pas activée sur ce compte" },
        { status: 400 },
      )
    }

    const settings = await getTwoFactorSettings()
    let isValid = verifyTotp(user.twoFactorSecret, code, {
      digits: settings.codeLength,
      period: settings.codePeriod,
      algorithm: settings.algorithm,
    })

    // Si le code TOTP ne correspond pas, tenter un code de secours à usage unique.
    let consumedBackupCodeIndex = -1
    if (!isValid) {
      for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
        if (await bcrypt.compare(code, user.twoFactorBackupCodes[i])) {
          isValid = true
          consumedBackupCodeIndex = i
          break
        }
      }
    }

    if (!isValid) {
      logger.warn('Invalid 2FA code', { email: user.email })
      return NextResponse.json<ApiResponse>({ success: false, error: "Code de vérification incorrect" }, { status: 401 })
    }

    if (consumedBackupCodeIndex !== -1) {
      // Un code de secours ne peut servir qu'une fois : on le retire immédiatement.
      const remainingBackupCodes = user.twoFactorBackupCodes.filter((_, i) => i !== consumedBackupCodeIndex)
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorBackupCodes: remainingBackupCodes } })
      logger.info('2FA backup code used', { email: user.email })
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    })
    const refreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    })

    logger.info('2FA login successful', { email: user.email })

    return NextResponse.json<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>>({
      success: true,
      data: {
        user: sanitizeUser(user) as User,
        accessToken,
        refreshToken,
      },
      message: "Connexion réussie",
    })
  } catch (error) {
    logger.error('2FA verify-login error', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la vérification du code" },
      { status: 500 },
    )
  }
}
