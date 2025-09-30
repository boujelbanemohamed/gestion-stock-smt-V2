import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Bank } from "@/lib/types"

// PUT /api/banks/[id] - Mettre à jour une banque
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { id } = params

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

    await prisma.bank.delete({
      where: { id }
    })

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