import { type NextRequest, NextResponse } from "next/server"
import type { ApiResponse } from "@/lib/api-types"

// GET /api/notifications - Récupérer les notifications
export async function GET(request: NextRequest) {
  try {
    // Pour l'instant, retourner un tableau vide
    // Cette fonctionnalité peut être implémentée plus tard
    return NextResponse.json<ApiResponse<any[]>>({
      success: true,
      data: [],
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
