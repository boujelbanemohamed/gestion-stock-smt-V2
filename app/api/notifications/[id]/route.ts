import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { requireAuth } from "@/lib/auth-middleware"

// PUT /api/notifications/[id] - Marquer comme lue

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()

    // Une notification ciblée (userId non nul) n'appartient qu'à son
    // destinataire ; les notifications globales (userId null) restent
    // partagées entre tous. On renvoie 404 plutôt que 403 pour ne pas
    // confirmer l'existence de la notification d'un autre utilisateur.
    const existing = await prisma.notification.findUnique({ where: { id: params.id } })
    if (!existing || (existing.userId && existing.userId !== auth.user.id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Notification non trouvée" },
        { status: 404 },
      )
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: params.id },
      data: {
        ...(body.isRead !== undefined && { isRead: body.isRead }),
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedNotification,
      message: "Notification mise à jour avec succès",
    })
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de la notification",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/notifications/[id] - Supprimer une notification
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const existing = await prisma.notification.findUnique({ where: { id: params.id } })
    if (!existing || (existing.userId && existing.userId !== auth.user.id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Notification non trouvée" },
        { status: 404 },
      )
    }

    await prisma.notification.delete({
      where: { id: params.id }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Notification supprimée avec succès",
    })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de la notification",
      },
      { status: 500 },
    )
  }
}