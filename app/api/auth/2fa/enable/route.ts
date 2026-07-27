import { type NextRequest, NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { requireAuth } from "@/lib/auth-middleware"
import { verifyTotp } from "@/lib/totp"
import { getTwoFactorSettings } from "@/lib/two-factor-config"
import { logAudit } from "@/lib/audit-logger"
import { sendAuthMethodChangedEmail } from "@/lib/email-service"

// POST /api/auth/2fa/enable - Confirme la mise en place de la 2FA avec un
// premier code TOTP valide, et génère les codes de secours à usage unique.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BACKUP_CODE_COUNT = 8

function generateBackupCode(): string {
  return randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    const code = typeof body.code === "string" ? body.code : ""

    const user = await prisma.user.findUnique({ where: { id: auth.user.id } })
    if (!user || !user.twoFactorSecret) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Aucune configuration 2FA en attente. Relancez la mise en place." },
        { status: 400 },
      )
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

    const isValid = verifyTotp(user.twoFactorSecret, code, {
      digits: settings.codeLength,
      period: settings.codePeriod,
      algorithm: settings.algorithm,
    })

    if (!isValid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Code de vérification incorrect" },
        { status: 400 },
      )
    }

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode)
    const hashedBackupCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)))

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: hashedBackupCodes },
    })

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "update",
      module: "users",
      entityType: "user",
      entityId: user.id,
      entityName: `${user.firstName} ${user.lastName}`,
      details: `Activation de la double authentification (2FA) par ${user.email}`,
      status: "success",
    }, request)

    try {
      await sendAuthMethodChangedEmail(user.email, user.firstName, "2fa")
    } catch (emailError) {
      console.error('Error sending auth method changed email:', emailError)
    }

    // Les codes de secours ne sont montrés qu'une seule fois : seule leur
    // empreinte (bcrypt) est conservée en base.
    return NextResponse.json<ApiResponse<{ backupCodes: string[] }>>({
      success: true,
      data: { backupCodes },
      message: "Double authentification activée avec succès",
    })
  } catch (error) {
    console.error('Error enabling 2FA:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de l'activation de la double authentification" },
      { status: 500 },
    )
  }
}
