import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { User, UserFilters } from "@/lib/types"

// GET /api/users - Récupérer tous les utilisateurs avec filtres optionnels
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filters: UserFilters = {}

    const role = searchParams.get("role")
    const status = searchParams.get("status")
    const searchTerm = searchParams.get("search")

    if (role) filters.role = role
    if (status && (status === "active" || status === "inactive" || status === "all")) {
      filters.status = status
    }
    if (searchTerm) filters.searchTerm = searchTerm

    const users = Object.keys(filters).length > 0 ? dataStore.searchUsers(filters) : dataStore.getAllUsers()

    return NextResponse.json<ApiResponse<User[]>>({
      success: true,
      data: users,
    })
  } catch (error) {
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

    const newUser = dataStore.addUser({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role,
      isActive: body.isActive !== undefined ? body.isActive : true,
    })

    return NextResponse.json<ApiResponse<User>>(
      {
        success: true,
        data: newUser,
        message: "Utilisateur créé avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création de l'utilisateur",
      },
      { status: 500 },
    )
  }
}
