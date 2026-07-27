import { type NextRequest, NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { requireAuth } from "@/lib/auth-middleware"
import { logAudit } from "@/lib/audit-logger"
import { sendAuthMethodChangedEmail } from "@/lib/email-service"

// POST /api/auth/2fa/disable - Désactive la 2FA de l'utilisateur connecté
// (re-authentification par mot de passe requise)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    const password = typeof body.password === "string" ? body.password : ""

    const user = await prisma.user.findUnique({ where: { id: auth.user.id } })
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Utilisateur non trouvé" }, { status: 404 })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Mot de passe incorrect" }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    })

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "update",
      module: "users",
      entityType: "user",
      entityId: user.id,
      entityName: `${user.firstName} ${user.lastName}`,
      details: `Désactivation de la double authentification (2FA) par ${user.email}`,
      status: "success",
    }, request)

    try {
      await sendAuthMethodChangedEmail(user.email, user.firstName, "password")
    } catch (emailError) {
      console.error('Error sending auth method changed email:', emailError)
    }

    return NextResponse.json<ApiResponse>({ success: true, message: "Double authentification désactivée" })
  } catch (error) {
    console.error('Error disabling 2FA:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la désactivation de la double authentification" },
      { status: 500 },
    )
  }
}
