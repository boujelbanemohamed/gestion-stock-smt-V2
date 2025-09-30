import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"

// GET /api/users/[id] - Récupérer un utilisateur par ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = dataStore.getUserById(params.id)

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Utilisateur non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: user,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de l'utilisateur",
      },
      { status: 500 },
    )
  }
}

// PUT /api/users/[id] - Mettre à jour un utilisateur
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const updatedUser = dataStore.updateUser(params.id, body)

    if (!updatedUser) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Utilisateur non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: updatedUser,
      message: "Utilisateur mis à jour avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de l'utilisateur",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/users/[id] - Supprimer (désactiver) un utilisateur
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = dataStore.deleteUser(params.id)

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Utilisateur non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Utilisateur supprimé avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de l'utilisateur",
      },
      { status: 500 },
    )
  }
}
