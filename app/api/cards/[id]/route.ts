import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Card } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

// GET /api/cards/[id] - Récupérer une carte par ID

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

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

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "update",
        module: "cards",
        entityType: "card",
        entityId: updatedCard.id,
        entityName: updatedCard.name,
        details: `Modification de la carte ${updatedCard.name} (${updatedCard.type})`,
        status: "success"
      }, request)
    }

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
    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

    // Vérifier si la carte existe
    const card = await prisma.card.findUnique({
      where: { id: params.id }
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

    // Vérifier si la carte a du stock dans les emplacements
    const stockLevels = await prisma.stockLevel.findMany({
      where: { cardId: params.id }
    })

    const totalStock = stockLevels.reduce((sum, level) => sum + level.quantity, 0)

    if (totalStock > 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Impossible de supprimer cette carte. Elle contient encore ${totalStock} unité(s) en stock dans les emplacements. Veuillez d'abord transférer ou sortir ce stock.`,
        },
        { status: 400 },
      )
    }

    // Si pas de stock, désactiver la carte
    await prisma.card.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "delete",
        module: "cards",
        entityType: "card",
        entityId: card.id,
        entityName: card.name,
        details: `Suppression de la carte ${card.name} (${card.type})`,
        status: "success"
      }, request)
    }

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