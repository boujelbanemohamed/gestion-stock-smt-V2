import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { Location } from "@/lib/types"

// GET /api/locations/[id] - Récupérer un emplacement par ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const locations = dataStore.getLocations()
    const location = locations.find((l) => l.id === params.id)

    if (!location) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Emplacement non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Location>>({
      success: true,
      data: location,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de l'emplacement",
      },
      { status: 500 },
    )
  }
}

// PUT /api/locations/[id] - Mettre à jour un emplacement
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const updatedLocation = dataStore.updateLocation(params.id, body)

    if (!updatedLocation) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Emplacement non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Location>>({
      success: true,
      data: updatedLocation,
      message: "Emplacement mis à jour avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de l'emplacement",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/locations/[id] - Supprimer (désactiver) un emplacement
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = dataStore.deleteLocation(params.id)

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Emplacement non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Emplacement supprimé avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de l'emplacement",
      },
      { status: 500 },
    )
  }
}
