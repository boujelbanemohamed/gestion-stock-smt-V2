import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Notification } from "@/lib/types"

// GET /api/notifications - Récupérer toutes les notifications
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const isRead = searchParams.get("isRead")

    const where: any = {}

    if (userId) {
      where.OR = [
        { userId: userId },
        { userId: null } // Notifications globales
      ]
    }

    if (isRead === "true") where.isRead = true
    if (isRead === "false") where.isRead = false

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json<ApiResponse<Notification[]>>({
      success: true,
      data: notifications as Notification[],
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des notifications",
      },
      { status: 500 },
    )
  }
}

// POST /api/notifications - Créer une nouvelle notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.title || !body.message || !body.type) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Champs requis manquants: title, message, type",
        },
        { status: 400 },
      )
    }

    const newNotification = await prisma.notification.create({
      data: {
        type: body.type,
        title: body.title,
        message: body.message,
        userId: body.userId || null,
        isRead: false,
      }
    })

    return NextResponse.json<ApiResponse<Notification>>(
      {
        success: true,
        data: newNotification as Notification,
        message: "Notification créée avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création de la notification",
      },
      { status: 500 },
    )
  }
}