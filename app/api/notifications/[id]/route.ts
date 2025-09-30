import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"

// PUT /api/notifications/[id] - Marquer une notification comme lue
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = dataStore.markNotificationAsRead(params.id)

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Notification non trouvée",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Notification marquée comme lue",
    })
  } catch (error) {
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
    const success = dataStore.deleteNotification(params.id)

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Notification non trouvée",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Notification supprimée avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de la notification",
      },
      { status: 500 },
    )
  }
}
