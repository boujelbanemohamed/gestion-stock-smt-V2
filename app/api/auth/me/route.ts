import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { verifyAuth } from "@/lib/auth-middleware"
import { sanitizeUser } from "@/lib/sanitize-user"

// GET /api/auth/me - Récupérer l'utilisateur connecté

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log(`[API /auth/me] Requête reçue`)
    
    // Vérifier l'authentification et récupérer les données utilisateur
    let userData
    try {
      userData = verifyAuth(request)
      console.log(`[API /auth/me] ✓ Utilisateur authentifié: ${userData.email}`)
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : String(authError)
      console.error(`[API /auth/me] ERREUR: Authentification échouée - ${errorMessage}`)
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: errorMessage,
        },
        { status: 401 },
      )
    }

    // Récupérer l'utilisateur complet depuis la base de données
    console.log(`[API /auth/me] Recherche de l'utilisateur avec ID: ${userData.id}`)
    const user = await prisma.user.findUnique({
      where: { id: userData.id }
    })

    if (!user) {
      console.error(`[API /auth/me] ERREUR: Utilisateur non trouvé dans la base avec ID: ${userData.id}`)
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Utilisateur non trouvé",
        },
        { status: 404 },
      )
    }

    console.log(`[API /auth/me] ✓ Utilisateur trouvé: ${user.email}`)

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: sanitizeUser(user) as User,
    })
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de l'utilisateur",
      },
      { status: 500 },
    )
  }
}