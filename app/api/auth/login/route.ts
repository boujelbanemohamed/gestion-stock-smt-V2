import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
      // Logger la tentative échouée (utilisateur inconnu)
      await logAudit({
        userId: "unknown",
        userEmail: email,
        action: "login",
        module: "auth",
        entityType: "user",
        details: `Tentative de connexion échouée - Utilisateur non trouvé`,
        status: "failure",
        errorMessage: "Email ou mot de passe incorrect"
      }, request)
      
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
      // Logger la tentative échouée (mauvais mot de passe)
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        action: "login",
        module: "auth",
        entityType: "user",
        details: `Tentative de connexion échouée - Mot de passe incorrect`,
        status: "failure",
        errorMessage: "Email ou mot de passe incorrect"
      }, request)
      
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
      // Logger la tentative échouée (compte désactivé)
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        action: "login",
        module: "auth",
        entityType: "user",
        details: `Tentative de connexion échouée - Compte désactivé`,
        status: "failure",
        errorMessage: "Ce compte est désactivé"
      }, request)
      
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Ce compte est désactivé",
        },
        { status: 403 },
      )
    }

    // Logger la connexion réussie
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "login",
      module: "auth",
      entityType: "user",
      entityId: user.id,
      entityName: `${user.firstName} ${user.lastName}`,
      details: `Connexion réussie`,
      status: "success"
    }, request)

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
