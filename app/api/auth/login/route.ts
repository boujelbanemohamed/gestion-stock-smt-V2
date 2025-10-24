import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    console.log('Login API called')
    
    const body = await request.json()
    const { email, password } = body

    console.log('Login attempt for email:', email)

    if (!email || !password) {
      console.log('Missing email or password')
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email et mot de passe requis",
        },
        { status: 400 },
      )
    }

    // Chercher l'utilisateur par email
    console.log('Searching for user in database...')
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.log('User not found:', email)
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email ou mot de passe incorrect",
        },
        { status: 401 },
      )
    }

    console.log('User found:', user.email, 'isActive:', user.isActive)

    // Vérifier que l'utilisateur est actif
    if (!user.isActive) {
      console.log('User account is inactive')
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Ce compte est désactivé",
        },
        { status: 403 },
      )
    }

    // Vérifier le mot de passe
    console.log('Verifying password...')
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      console.log('Invalid password')
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email ou mot de passe incorrect",
        },
        { status: 401 },
      )
    }

    console.log('Login successful for user:', user.email)

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