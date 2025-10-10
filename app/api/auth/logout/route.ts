import { type NextRequest, NextResponse } from "next/server"
import type { ApiResponse } from "@/lib/api-types"

// POST /api/auth/logout - Déconnexion

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Dans une vraie app, on supprimerait le token/session ici
    // Pour l'instant, on retourne juste success
    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Déconnexion réussie",
    })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la déconnexion",
      },
      { status: 500 },
    )
  }
}