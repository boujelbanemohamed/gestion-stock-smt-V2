import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Notification } from "@/lib/types"
import { requireAuth } from "@/lib/auth-middleware"
import { serverEvents } from "@/lib/server-events"

// GET /api/notifications - Récupérer les notifications

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const searchParams = request.nextUrl.searchParams
    const unreadOnly = searchParams.get("unreadOnly") === "true"

    // Notifications globales (userId null) + notifications de l'utilisateur
    // authentifié. L'identité vient toujours du token vérifié, jamais d'un
    // paramètre de requête qu'un client pourrait forger pour lire les
    // notifications ciblées d'un autre utilisateur.
    const where: any = {
      OR: [
        { userId: null },
        { userId: auth.user.id },
      ],
    }

    // Filtrer les notifications non lues si demandé
    if (unreadOnly) {
      where.isRead = false
    }

    // Récupérer les notifications
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50, // Limiter à 50 notifications
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

// POST /api/notifications - Créer une notification
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    
    const notification = await prisma.notification.create({
      data: {
        type: body.type || "info",
        title: body.title,
        message: body.message,
        userId: body.userId || null,  // null = notification globale
        isRead: false,
      },
    })

    // Pousse la notification en temps réel (SSE) aux clients connectés.
    serverEvents.emit("notification", notification)

    return NextResponse.json<ApiResponse<Notification>>({
      success: true,
      data: notification as Notification,
      message: "Notification créée avec succès",
    }, { status: 201 })
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
