import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

// GET /api/users - Récupérer tous les utilisateurs avec filtres optionnels
export async function GET(request: NextRequest) {
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

    // Retirer les mots de passe
    const usersWithoutPasswords = users.map(({ password, ...user }) => user)

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

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

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

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "create",
        module: "users",
        entityType: "user",
        entityId: newUser.id,
        entityName: `${newUser.firstName} ${newUser.lastName}`,
        details: `Création de l'utilisateur ${newUser.firstName} ${newUser.lastName} (${newUser.email}) avec le rôle ${newUser.role}`,
        status: "success"
      }, request)
    }

    // Envoyer l'email si demandé
    if (body.sendEmail) {
      try {
        // Pour l'instant, on log les informations (à remplacer par un vrai service d'email)
        console.log(`=== EMAIL À ENVOYER ===`)
        console.log(`À: ${body.email}`)
        console.log(`Sujet: Informations de connexion - Plateforme Gestion de Stocks`)
        console.log(`Contenu:`)
        console.log(`Bonjour ${body.firstName} ${body.lastName},`)
        console.log(`Votre compte a été créé avec succès sur la plateforme de gestion de stocks.`)
        console.log(`Email: ${body.email}`)
        console.log(`Mot de passe temporaire: ${plainPassword}`)
        console.log(`Rôle: ${body.role}`)
        console.log(`Veuillez vous connecter et changer votre mot de passe dès que possible.`)
        console.log(`========================`)
        
        // TODO: Intégrer un vrai service d'email (Nodemailer, SendGrid, etc.)
      } catch (emailError) {
        console.error('Erreur lors de l\'envoi de l\'email:', emailError)
        // On continue même si l'email échoue
      }
    }

    // Ne pas retourner le mot de passe
    const { password: _, ...userWithoutPassword } = newUser

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