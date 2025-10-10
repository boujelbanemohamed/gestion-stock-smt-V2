import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Movement } from "@/lib/types"

// GET /api/movements/[id] - Récupérer un mouvement par ID

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const movement = await prisma.movement.findUnique({
      where: { id: params.id },
      include: {
        card: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          }
        },
        fromLocation: true,
        toLocation: true,
      }
    })

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
      data: movement as Movement,
    })
  } catch (error) {
    console.error('Error fetching movement:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération du mouvement",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/movements/[id] - Supprimer un mouvement
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.movement.delete({
      where: { id: params.id }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Mouvement supprimé avec succès",
    })
  } catch (error) {
    console.error('Error deleting movement:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression du mouvement",
      },
      { status: 500 },
    )
  }
}