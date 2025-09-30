import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { Bank } from "@/lib/types"

// GET /api/banks/[id] - Récupérer une banque par ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const bank = dataStore.getBankById(params.id)

    if (!bank) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Banque non trouvée",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Bank>>({
      success: true,
      data: bank,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de la banque",
      },
      { status: 500 },
    )
  }
}

// PUT /api/banks/[id] - Mettre à jour une banque
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const updatedBank = dataStore.updateBank(params.id, body)

    if (!updatedBank) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Banque non trouvée",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Bank>>({
      success: true,
      data: updatedBank,
      message: "Banque mise à jour avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de la banque",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/banks/[id] - Supprimer (désactiver) une banque
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = dataStore.deleteBank(params.id)

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Banque non trouvée",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Banque supprimée avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de la banque",
      },
      { status: 500 },
    )
  }
}
