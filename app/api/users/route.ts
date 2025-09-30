import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"

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

    // Hash du mot de passe (défaut: "password123")
    const hashedPassword = await bcrypt.hash(body.password || "password123", 10)

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

    // Ne pas retourner le mot de passe
    const { password: _, ...userWithoutPassword } = newUser

    return NextResponse.json<ApiResponse<User>>(
      {
        success: true,
        data: userWithoutPassword as User,
        message: "Utilisateur créé avec succès",
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