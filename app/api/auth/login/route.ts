import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email et mot de passe requis",
        },
        { status: 400 },
      )
    }

    // Chercher l'utilisateur par email
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email ou mot de passe incorrect",
        },
        { status: 401 },
      )
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email ou mot de passe incorrect",
        },
        { status: 401 },
      )
    }

    // Vérifier que l'utilisateur est actif
    if (!user.isActive) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Ce compte est désactivé",
        },
        { status: 403 },
      )
    }

    // Ne pas retourner le mot de passe
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: userWithoutPassword as User,
      message: "Connexion réussie",
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la connexion",
      },
      { status: 500 },
    )
  }
}
