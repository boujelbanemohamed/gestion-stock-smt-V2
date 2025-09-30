import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { Movement } from "@/lib/types"

// GET /api/movements/[id] - Récupérer un mouvement par ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const movements = dataStore.getMovements()
    const movement = movements.find((m) => m.id === params.id)

    if (!movement) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Mouvement non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Movement>>({
      success: true,
      data: movement,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération du mouvement",
      },
      { status: 500 },
    )
  }
}

// PUT /api/movements/[id] - Mettre à jour un mouvement
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const updatedMovement = dataStore.updateMovement(params.id, body)

    if (!updatedMovement) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Mouvement non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Movement>>({
      success: true,
      data: updatedMovement,
      message: "Mouvement mis à jour avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour du mouvement",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/movements/[id] - Supprimer un mouvement
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = dataStore.deleteMovement(params.id)

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Mouvement non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Mouvement supprimé avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression du mouvement",
      },
      { status: 500 },
    )
  }
}
