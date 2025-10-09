import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Bank } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

// PUT /api/banks/[id] - Mettre à jour une banque
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { id } = params

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

    const updatedBank = await prisma.bank.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.code !== undefined && { code: body.code }),
        ...(body.country !== undefined && { country: body.country }),
        ...(body.swiftCode !== undefined && { swiftCode: body.swiftCode }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      }
    })

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "update",
        module: "banks",
        entityType: "bank",
        entityId: updatedBank.id,
        entityName: updatedBank.name,
        details: `Modification de la banque ${updatedBank.name} (${updatedBank.code})`,
        status: "success"
      }, request)
    }

    return NextResponse.json<ApiResponse<Bank>>({
      success: true,
      data: updatedBank as Bank,
      message: "Banque mise à jour avec succès"
    })
  } catch (error) {
    console.error('Error updating bank:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de la banque"
      },
      { status: 500 }
    )
  }
}

// DELETE /api/banks/[id] - Supprimer une banque
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

    // Récupérer les infos de la banque avant suppression
    const bank = await prisma.bank.findUnique({
      where: { id }
    })

    await prisma.bank.delete({
      where: { id }
    })

    // Logger l'action
    if (userData && bank) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "delete",
        module: "banks",
        entityType: "bank",
        entityId: id,
        entityName: bank.name,
        details: `Suppression de la banque ${bank.name} (${bank.code})`,
        status: "success"
      }, request)
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Banque supprimée avec succès"
    })
  } catch (error) {
    console.error('Error deleting bank:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de la banque"
      },
      { status: 500 }
    )
  }
}