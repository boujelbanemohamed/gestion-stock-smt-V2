import { type NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { verifyTwoFactorPendingToken } from "@/lib/auth"
import { generateBase32Secret, buildOtpAuthUri } from "@/lib/totp"
import { getTwoFactorSettings } from "@/lib/two-factor-config"
import { twoFactorRateLimiter } from "@/lib/rate-limiter"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/auth/2fa/setup-login - Première étape de la configuration 2FA
// forcée par un administrateur : l'utilisateur vient de saisir un mot de passe
// valide (jeton temporaire émis par /api/auth/login) mais son compte exige la
// 2FA sans qu'il ait encore configuré d'application d'authentification.
// Génère un nouveau secret TOTP, à confirmer via /api/auth/2fa/enable-login.
export async function POST(request: NextRequest) {
  const rateLimitResponse = twoFactorRateLimiter(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const tempToken = typeof body.tempToken === "string" ? body.tempToken : ""

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

    if (!user.twoFactorEnabled) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "La double authentification n'est pas requise pour ce compte" },
        { status: 400 },
      )
    }

    const settings = await getTwoFactorSettings()
    if (!settings.enabled) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "La double authentification n'est pas disponible actuellement" },
        { status: 400 },
      )
    }

    const secret = generateBase32Secret()

    // Le secret est mémorisé dès cette étape ; la connexion reste bloquée tant
    // que l'utilisateur n'a pas confirmé un code valide via enable-login.
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    })

    const otpauthUri = buildOtpAuthUri({
      secret,
      accountName: user.email,
      issuer: settings.issuer,
      digits: settings.codeLength,
      period: settings.codePeriod,
      algorithm: settings.algorithm,
    })
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri)

    return NextResponse.json<ApiResponse<{ secret: string; otpauthUri: string; qrCodeDataUrl: string }>>({
      success: true,
      data: { secret, otpauthUri, qrCodeDataUrl },
    })
  } catch (error) {
    console.error('Error preparing forced 2FA setup:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la préparation de la double authentification" },
      { status: 500 },
    )
  }
}
