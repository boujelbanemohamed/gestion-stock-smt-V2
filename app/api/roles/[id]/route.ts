import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { RolePermissions } from "@/lib/types"

// PUT /api/roles/[id] - Mettre à jour un rôle
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const updatedRole = dataStore.updateRole(params.id, body)

    if (!updatedRole) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Rôle non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<RolePermissions>>({
      success: true,
      data: updatedRole,
      message: "Rôle mis à jour avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour du rôle",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/roles/[id] - Supprimer un rôle personnalisé
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = dataStore.deleteRole(params.id)

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Rôle non trouvé ou impossible de supprimer un rôle système",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Rôle supprimé avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression du rôle",
      },
      { status: 500 },
    )
  }
}
