import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { RolePermissions } from "@/lib/types"
import { eventBus } from "@/lib/event-bus"

// PUT /api/roles/[id] - Mettre à jour un rôle
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const role = await prisma.rolePermission.findUnique({
      where: { id: params.id }
    })

    if (!role) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Rôle non trouvé",
        },
        { status: 404 },
      )
    }

    // Permettre la modification des permissions des rôles système
    // mais empêcher la modification du nom du rôle pour les rôles système
    if (!role.isCustom && body.role !== undefined && body.role !== role.role) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Impossible de modifier le nom d'un rôle système",
        },
        { status: 403 },
      )
    }

    const updatedRole = await prisma.rolePermission.update({
      where: { id: params.id },
      data: {
        ...(body.role !== undefined && { role: body.role }),
        ...(body.permissions !== undefined && { permissions: body.permissions }),
        ...(body.description !== undefined && { description: body.description }),
      }
    })

    // Émettre l'événement de synchronisation
    eventBus.emit("role:updated", { roleId: params.id, role: updatedRole.role })

    return NextResponse.json<ApiResponse<RolePermissions>>({
      success: true,
      data: updatedRole as RolePermissions,
      message: "Rôle mis à jour avec succès",
    })
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour du rôle",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/roles/[id] - Supprimer un rôle
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const role = await prisma.rolePermission.findUnique({
      where: { id: params.id }
    })

    if (!role) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Rôle non trouvé",
        },
        { status: 404 },
      )
    }

    // Ne pas permettre la suppression des rôles système
    if (!role.isCustom) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Impossible de supprimer un rôle système",
        },
        { status: 403 },
      )
    }

    await prisma.rolePermission.delete({
      where: { id: params.id }
    })

    // Émettre l'événement de synchronisation
    eventBus.emit("role:deleted", { roleId: params.id, role: role.role })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Rôle supprimé avec succès",
    })
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression du rôle",
      },
      { status: 500 },
    )
  }
}