import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { RolePermissions } from "@/lib/types"

// GET /api/roles - Récupérer tous les rôles et permissions
export async function GET() {
  try {
    const roles = dataStore.getRolePermissions()

    return NextResponse.json<ApiResponse<RolePermissions[]>>({
      success: true,
      data: roles,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des rôles",
      },
      { status: 500 },
    )
  }
}

// POST /api/roles - Créer un nouveau rôle personnalisé
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.role || !body.permissions || !Array.isArray(body.permissions)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Champs requis manquants: role, permissions (array)",
        },
        { status: 400 },
      )
    }

    const newRole = dataStore.addRole({
      role: body.role,
      permissions: body.permissions,
      description: body.description || "",
      isCustom: true,
    })

    return NextResponse.json<ApiResponse<RolePermissions>>(
      {
        success: true,
        data: newRole,
        message: "Rôle créé avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création du rôle",
      },
      { status: 500 },
    )
  }
}
