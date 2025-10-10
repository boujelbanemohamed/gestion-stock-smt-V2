import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { RolePermissions } from "@/lib/types"
import { eventBus } from "@/lib/event-bus"
import { logAudit } from "@/lib/audit-logger"

// PUT /api/roles/[id] - Mettre à jour un rôle

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

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

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "update",
        module: "roles",
        entityType: "role",
        entityId: updatedRole.id,
        entityName: updatedRole.role,
        details: `Modification du rôle ${updatedRole.role}`,
        status: "success"
      }, request)
    }

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
    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

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

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "delete",
        module: "roles",
        entityType: "role",
        entityId: role.id,
        entityName: role.role,
        details: `Suppression du rôle ${role.role}`,
        status: "success"
      }, request)
    }

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