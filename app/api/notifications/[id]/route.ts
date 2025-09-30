import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"

// PUT /api/notifications/[id] - Marquer comme lue
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

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
  try {
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