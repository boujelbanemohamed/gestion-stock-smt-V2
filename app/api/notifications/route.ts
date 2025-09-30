import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { Notification } from "@/lib/types"

// GET /api/notifications - Récupérer les notifications
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const unreadOnly = searchParams.get("unreadOnly") === "true"

    let notifications

    if (unreadOnly) {
      notifications = dataStore.getUnreadNotifications(userId || undefined)
    } else {
      notifications = dataStore.getNotifications(userId || undefined)
    }

    return NextResponse.json<ApiResponse<Notification[]>>({
      success: true,
      data: notifications,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des notifications",
      },
      { status: 500 },
    )
  }
}

// POST /api/notifications - Créer une notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.type || !body.title || !body.message) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Champs requis manquants: type, title, message",
        },
        { status: 400 },
      )
    }

    const notification = dataStore.addNotification({
      type: body.type,
      title: body.title,
      message: body.message,
      userId: body.userId,
    })

    return NextResponse.json<ApiResponse<Notification>>(
      {
        success: true,
        data: notification,
        message: "Notification créée avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création de la notification",
      },
      { status: 500 },
    )
  }
}
