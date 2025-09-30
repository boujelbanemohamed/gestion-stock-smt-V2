import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { Card } from "@/lib/types"

// GET /api/cards/[id] - Récupérer une carte par ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cards = dataStore.getCards()
    const card = cards.find((c) => c.id === params.id)

    if (!card) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Carte non trouvée",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Card>>({
      success: true,
      data: card,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de la carte",
      },
      { status: 500 },
    )
  }
}

// PUT /api/cards/[id] - Mettre à jour une carte
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const updatedCard = dataStore.updateCard(params.id, body)

    if (!updatedCard) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Carte non trouvée",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Card>>({
      success: true,
      data: updatedCard,
      message: "Carte mise à jour avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de la carte",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/cards/[id] - Supprimer (désactiver) une carte
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = dataStore.deleteCard(params.id)

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Carte non trouvée",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Carte supprimée avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de la carte",
      },
      { status: 500 },
    )
  }
}
