import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Location } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

// GET /api/locations/[id] - Récupérer un emplacement par ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const location = await prisma.location.findUnique({
      where: { id: params.id },
      include: {
        bank: true
      }
    })

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
      data: location as Location,
    })
  } catch (error) {
    console.error('Error fetching location:', error)
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

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

    const updatedLocation = await prisma.location.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.bankId !== undefined && { bankId: body.bankId }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      }
    })

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "update",
        module: "locations",
        entityType: "location",
        entityId: updatedLocation.id,
        entityName: updatedLocation.name,
        details: `Modification de l'emplacement ${updatedLocation.name}`,
        status: "success"
      }, request)
    }

    return NextResponse.json<ApiResponse<Location>>({
      success: true,
      data: updatedLocation as Location,
      message: "Emplacement mis à jour avec succès",
    })
  } catch (error) {
    console.error('Error updating location:', error)
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
    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

    // Récupérer les infos avant suppression
    const location = await prisma.location.findUnique({
      where: { id: params.id }
    })

    await prisma.location.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    // Logger l'action
    if (userData && location) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "delete",
        module: "locations",
        entityType: "location",
        entityId: location.id,
        entityName: location.name,
        details: `Suppression de l'emplacement ${location.name}`,
        status: "success"
      }, request)
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Emplacement supprimé avec succès",
    })
  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de l'emplacement",
      },
      { status: 500 },
    )
  }
}