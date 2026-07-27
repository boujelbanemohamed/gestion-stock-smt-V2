import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAuth, requireAdmin, isAdminRole } from "@/lib/auth-middleware"
import { sanitizeUser } from "@/lib/sanitize-user"
import { sendPasswordChangedConfirmationEmail } from "@/lib/email-service"

// GET /api/users/[id] - Récupérer un utilisateur par ID

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Utilisateur non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: sanitizeUser(user) as User,
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de l'utilisateur",
      },
      { status: 500 },
    )
  }
}

// PUT /api/users/[id] - Mettre à jour un utilisateur
// Un utilisateur peut modifier son propre profil (nom, email, mot de passe),
// mais seul un administrateur peut modifier le rôle ou le statut actif
// (à soi-même ou à un autre utilisateur), et seul un administrateur peut
// modifier le compte d'un tiers.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  const userData = auth.user
  const isSelf = userData.id === params.id
  const isAdmin = isAdminRole(userData.role)

  if (!isSelf && !isAdmin) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Accès refusé. Vous ne pouvez modifier que votre propre profil." },
      { status: 403 },
    )
  }

  try {
    const body = await request.json()

    // Si le mot de passe est fourni, le hasher
    const updateData: any = {}
    if (body.email !== undefined) updateData.email = body.email
    if (body.firstName !== undefined) updateData.firstName = body.firstName
    if (body.lastName !== undefined) updateData.lastName = body.lastName

    // Le rôle et le statut actif ne peuvent être modifiés que par un administrateur,
    // même sur son propre compte (empêche l'auto-élévation de privilèges).
    if (isAdmin) {
      if (body.role !== undefined) updateData.role = body.role
      if (body.isActive !== undefined) updateData.isActive = body.isActive
    }

    const passwordChanged = Boolean(body.password)
    if (passwordChanged) {
      updateData.password = await bcrypt.hash(body.password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData
    })

    // Logger l'action (toujours créer un log)
    // Ne jamais logguer le mot de passe lui-même, seulement le fait qu'il a été changé.
    await logAudit({
      userId: userData?.id || "system",
      userEmail: userData?.email || "system@monetique.tn",
      action: "update",
      module: "users",
      entityType: "user",
      entityId: updatedUser.id,
      entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
      details: `Modification de l'utilisateur ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email})${userData ? ` par ${userData.email}` : ' (utilisateur non identifié)'}${passwordChanged ? ' — Mot de passe réinitialisé' : ''}`,
      status: "success"
    }, request)

    if (passwordChanged) {
      try {
        await sendPasswordChangedConfirmationEmail(updatedUser.email, updatedUser.firstName)
      } catch (emailError) {
        console.error('Error sending password changed confirmation email:', emailError)
        // On ne fait jamais échouer la mise à jour à cause d'un email non envoyé.
      }
    }

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: sanitizeUser(updatedUser) as User,
      message: "Utilisateur mis à jour avec succès",
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de l'utilisateur",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/users/[id] - Supprimer (désactiver) un utilisateur
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response
  const userData = auth.user

  try {
    // Récupérer les infos avant suppression
    const user = await prisma.user.findUnique({
      where: { id: params.id }
    })

    // On désactive plutôt que de supprimer pour garder l'historique
    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    // Logger l'action (toujours créer un log si l'utilisateur existe)
    if (user) {
      await logAudit({
        userId: userData?.id || "system",
        userEmail: userData?.email || "system@monetique.tn",
        action: "delete",
        module: "users",
        entityType: "user",
        entityId: user.id,
        entityName: `${user.firstName} ${user.lastName}`,
        details: `Suppression de l'utilisateur ${user.firstName} ${user.lastName} (${user.email})${userData ? ` par ${userData.email}` : ' (utilisateur non identifié)'}`,
        status: "success"
      }, request)
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Utilisateur supprimé avec succès",
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de l'utilisateur",
      },
      { status: 500 },
    )
  }
}