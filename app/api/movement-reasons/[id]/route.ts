import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { MovementReason } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAdmin } from "@/lib/auth-middleware"

// PUT /api/movement-reasons/[id] - Mettre à jour un motif (admin uniquement)
// DELETE /api/movement-reasons/[id] - Supprimer un motif (admin uniquement, sauf "Autre")

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()

    const reason = await prisma.movementReason.findUnique({ where: { id: params.id } })
    if (!reason) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Motif non trouvé" },
        { status: 404 },
      )
    }

    if (body.label !== undefined && (typeof body.label !== "string" || !body.label.trim())) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Le libellé du motif ne peut pas être vide" },
        { status: 400 },
      )
    }

    const updatedReason = await prisma.movementReason.update({
      where: { id: params.id },
      data: {
        ...(body.label !== undefined && { label: body.label.trim() }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        // isOther n'est jamais modifiable via l'API : c'est un indicateur système.
      },
    })

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: "update",
      module: "config",
      entityType: "movement_reason",
      entityId: updatedReason.id,
      entityName: updatedReason.label,
      details: `Modification du motif "${updatedReason.label}" par ${auth.user.email}`,
      status: "success",
    }, request)

    return NextResponse.json<ApiResponse<MovementReason>>({
      success: true,
      data: updatedReason as MovementReason,
      message: "Motif mis à jour avec succès",
    })
  } catch (error) {
    console.error('Error updating movement reason:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la mise à jour du motif" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const reason = await prisma.movementReason.findUnique({ where: { id: params.id } })
    if (!reason) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Motif non trouvé" },
        { status: 404 },
      )
    }

    if (reason.isOther) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Le motif \"Autre\" ne peut pas être supprimé" },
        { status: 403 },
      )
    }

    await prisma.movementReason.delete({ where: { id: params.id } })

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: "delete",
      module: "config",
      entityType: "movement_reason",
      entityId: reason.id,
      entityName: reason.label,
      details: `Suppression du motif "${reason.label}" par ${auth.user.email}`,
      status: "success",
    }, request)

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Motif supprimé avec succès",
    })
  } catch (error) {
    console.error('Error deleting movement reason:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la suppression du motif" },
      { status: 500 },
    )
  }
}
