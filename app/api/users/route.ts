import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAdmin } from "@/lib/auth-middleware"
import { sanitizeUser } from "@/lib/sanitize-user"

// GET /api/users - Récupérer tous les utilisateurs avec filtres optionnels

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const searchParams = request.nextUrl.searchParams
    const role = searchParams.get("role")
    const status = searchParams.get("status")
    const searchTerm = searchParams.get("search")

    const where: any = {}

    if (role && role !== "all") where.role = role
    if (status === "active") where.isActive = true
    if (status === "inactive") where.isActive = false
    
    if (searchTerm) {
      where.OR = [
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    const usersWithoutPasswords = users.map(sanitizeUser)

    return NextResponse.json<ApiResponse<User[]>>({
      success: true,
      data: usersWithoutPasswords as User[],
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des utilisateurs",
      },
      { status: 500 },
    )
  }
}

// POST /api/users - Créer un nouvel utilisateur
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()

    // Validation des champs requis
    if (!body.email || !body.firstName || !body.lastName || !body.role) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Champs requis manquants: email, firstName, lastName, role",
        },
        { status: 400 },
      )
    }

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email }
    })

    if (existingUser) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Un utilisateur avec cet email existe déjà",
        },
        { status: 400 },
      )
    }

    // Générer ou utiliser le mot de passe fourni
    let plainPassword: string
    if (body.password && body.password.trim() !== "") {
      plainPassword = body.password
    } else {
      // Générer un mot de passe aléatoire
      plainPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(plainPassword, 10)

    // Identité de l'appelant (issue du JWT vérifié par requireAdmin, jamais d'un header client)
    const userData = auth.user

    const newUser = await prisma.user.create({
      data: {
        email: body.email,
        password: hashedPassword,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        isActive: body.isActive !== undefined ? body.isActive : true,
      }
    })

    // Logger l'action (toujours créer un log)
    await logAudit({
      userId: userData?.id || "system",
      userEmail: userData?.email || "system@monetique.tn",
      action: "create",
      module: "users",
      entityType: "user",
      entityId: newUser.id,
      entityName: `${newUser.firstName} ${newUser.lastName}`,
      details: `Création de l'utilisateur ${newUser.firstName} ${newUser.lastName} (${newUser.email}) avec le rôle ${newUser.role}${userData ? ` par ${userData.email}` : ' (utilisateur non identifié)'}`,
      status: "success"
    }, request)

    // Envoyer l'email si demandé
    if (body.sendEmail) {
      try {
        const { sendUserWelcomeEmail } = await import("@/lib/email-service")
        await sendUserWelcomeEmail(
          body.email,
          body.firstName,
          body.lastName,
          plainPassword,
          body.role
        )
      } catch (emailError) {
        console.error('Erreur lors de l\'envoi de l\'email:', emailError)
        // On continue même si l'email échoue
      }
    }

    const userWithoutPassword = sanitizeUser(newUser)

    return NextResponse.json<ApiResponse<User>>(
      {
        success: true,
        data: userWithoutPassword as User,
        message: body.sendEmail 
          ? "Utilisateur créé avec succès et informations envoyées par email"
          : "Utilisateur créé avec succès",
        // Retourner le mot de passe en clair seulement si demandé et pas d'email
        ...(body.sendEmail ? {} : { generatedPassword: plainPassword })
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création de l'utilisateur",
      },
      { status: 500 },
    )
  }
}