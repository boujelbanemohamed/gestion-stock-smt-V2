import { type NextRequest, NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { signAccessToken, signRefreshToken, verifyTwoFactorPendingToken } from "@/lib/auth"
import { verifyTotp } from "@/lib/totp"
import { getTwoFactorSettings } from "@/lib/two-factor-config"
import { sanitizeUser } from "@/lib/sanitize-user"
import { twoFactorRateLimiter } from "@/lib/rate-limiter"
import { logger } from "@/lib/logger"
import { logAudit } from "@/lib/audit-logger"
import { sendAuthMethodChangedEmail } from "@/lib/email-service"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BACKUP_CODE_COUNT = 8

function generateBackupCode(): string {
  return randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
}

// POST /api/auth/2fa/enable-login - Confirme la configuration 2FA forcée avec
// un premier code TOTP valide, puis délivre les vrais tokens de session :
// cette étape termine la connexion, comme /api/auth/2fa/verify-login.
export async function POST(request: NextRequest) {
  const rateLimitResponse = twoFactorRateLimiter(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const tempToken = typeof body.tempToken === "string" ? body.tempToken : ""
    const code = typeof body.code === "string" ? body.code.trim() : ""

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
        { success: false, error: "Aucune configuration 2FA en attente. Relancez la mise en place." },
        { status: 400 },
      )
    }

    const settings = await getTwoFactorSettings()
    const isValid = verifyTotp(user.twoFactorSecret, code, {
      digits: settings.codeLength,
      period: settings.codePeriod,
      algorithm: settings.algorithm,
    })

    if (!isValid) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Code de vérification incorrect" }, { status: 400 })
    }

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode)
    const hashedBackupCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)))

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodes: hashedBackupCodes },
    })

    const accessToken = signAccessToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
    })
    const refreshToken = signRefreshToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
    })

    logger.info('2FA forced setup completed, login successful', { email: updatedUser.email })
    await logAudit({
      userId: updatedUser.id,
      userEmail: updatedUser.email,
      action: "login",
      module: "auth",
      entityType: "user",
      entityId: updatedUser.id,
      entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
      details: `Connexion réussie de ${updatedUser.email} (première configuration de la double authentification)`,
      status: "success",
    }, request)

    try {
      await sendAuthMethodChangedEmail(updatedUser.email, updatedUser.firstName, "2fa")
    } catch (emailError) {
      logger.error('Error sending auth method changed email', emailError)
    }

    return NextResponse.json<ApiResponse<{ user: User; accessToken: string; refreshToken: string; backupCodes: string[] }>>({
      success: true,
      data: {
        user: sanitizeUser(updatedUser) as User,
        accessToken,
        refreshToken,
        backupCodes,
      },
      message: "Double authentification configurée avec succès",
    })
  } catch (error) {
    logger.error('2FA enable-login error', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de l'activation de la double authentification" },
      { status: 500 },
    )
  }
}
