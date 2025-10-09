import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { RolePermissions } from "@/lib/types"
import { eventBus } from "@/lib/event-bus"
import { logAudit } from "@/lib/audit-logger"

// GET /api/roles - Récupérer tous les rôles
export async function GET(request: NextRequest) {
  try {
    const roles = await prisma.rolePermission.findMany({
      orderBy: { role: 'asc' }
    })

    return NextResponse.json<ApiResponse<RolePermissions[]>>({
      success: true,
      data: roles as RolePermissions[],
    })
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des rôles",
      },
      { status: 500 },
    )
  }
}

// POST /api/roles - Créer un nouveau rôle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

    if (!body.role || !body.permissions) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Champs requis manquants: role, permissions",
        },
        { status: 400 },
      )
    }

    const newRole = await prisma.rolePermission.create({
      data: {
        role: body.role,
        permissions: body.permissions,
        description: body.description || "",
        isCustom: body.isCustom !== undefined ? body.isCustom : true,
      }
    })

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "create",
        module: "roles",
        entityType: "role",
        entityId: newRole.id,
        entityName: newRole.role,
        details: `Création du rôle ${newRole.role} avec ${Array.isArray(newRole.permissions) ? newRole.permissions.length : 0} permission(s)`,
        status: "success"
      }, request)
    }

    // Émettre l'événement de synchronisation
    eventBus.emit("role:created", { roleId: newRole.id, role: newRole.role })

    return NextResponse.json<ApiResponse<RolePermissions>>(
      {
        success: true,
        data: newRole as RolePermissions,
        message: "Rôle créé avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating role:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création du rôle",
      },
      { status: 500 },
    )
  }
}