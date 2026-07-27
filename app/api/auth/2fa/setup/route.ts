import { type NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { requireAuth } from "@/lib/auth-middleware"
import { generateBase32Secret, buildOtpAuthUri } from "@/lib/totp"
import { getTwoFactorSettings } from "@/lib/two-factor-config"

// POST /api/auth/2fa/setup - Génère un nouveau secret TOTP pour l'utilisateur
// connecté (à confirmer ensuite via /api/auth/2fa/enable)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const user = await prisma.user.findUnique({ where: { id: auth.user.id } })
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Utilisateur non trouvé" }, { status: 404 })
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "La double authentification est déjà activée" },
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

    // Le secret est mémorisé dès cette étape ; la 2FA reste désactivée tant que
    // l'utilisateur n'a pas confirmé un code valide via /api/auth/2fa/enable.
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
    console.error('Error setting up 2FA:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la préparation de la double authentification" },
      { status: 500 },
    )
  }
}
