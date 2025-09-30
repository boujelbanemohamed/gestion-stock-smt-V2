import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"

// GET /api/auth/me - Récupérer l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    // Dans une vraie app, on récupérerait l'ID depuis le token/session
    // Pour l'instant, on simule avec l'email dans le header
    const email = request.headers.get("x-user-email")

    if (!email) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Non authentifié",
        },
        { status: 401 },
      )
    }

    const user = await prisma.user.findUnique({
      where: { email }
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

    // Ne pas retourner le mot de passe
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: userWithoutPassword as User,
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