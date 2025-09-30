import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Card } from "@/lib/types"

// GET /api/cards/[id] - Récupérer une carte par ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const card = await prisma.card.findUnique({
      where: { id: params.id },
      include: {
        bank: true
      }
    })

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
      data: card as Card,
    })
  } catch (error) {
    console.error('Error fetching card:', error)
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

    const updatedCard = await prisma.card.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.subType !== undefined && { subType: body.subType }),
        ...(body.subSubType !== undefined && { subSubType: body.subSubType }),
        ...(body.bankId !== undefined && { bankId: body.bankId }),
        ...(body.quantity !== undefined && { quantity: body.quantity }),
        ...(body.minThreshold !== undefined && { minThreshold: body.minThreshold }),
        ...(body.maxThreshold !== undefined && { maxThreshold: body.maxThreshold }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      }
    })

    return NextResponse.json<ApiResponse<Card>>({
      success: true,
      data: updatedCard as Card,
      message: "Carte mise à jour avec succès",
    })
  } catch (error) {
    console.error('Error updating card:', error)
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
    await prisma.card.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Carte supprimée avec succès",
    })
  } catch (error) {
    console.error('Error deleting card:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de la carte",
      },
      { status: 500 },
    )
  }
}