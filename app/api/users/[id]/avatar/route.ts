import { type NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAuth, isAdminRole } from "@/lib/auth-middleware"
import { sanitizeUser } from "@/lib/sanitize-user"

// POST /api/users/[id]/avatar - Téléverse l'avatar d'un utilisateur (soi-même ou un admin)
// DELETE /api/users/[id]/avatar - Retire l'avatar d'un utilisateur (soi-même ou un admin)

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 Mo

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
}

function canManageAvatar(auth: { id: string; role: string }, targetUserId: string): boolean {
  return auth.id === targetUserId || isAdminRole(auth.role)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  if (!canManageAvatar(auth.user, params.id)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Accès refusé. Vous ne pouvez modifier que votre propre avatar." },
      { status: 403 },
    )
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: params.id } })
    if (!targetUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Utilisateur non trouvé" },
        { status: 404 },
      )
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Aucun fichier fourni" },
        { status: 400 },
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "L'image dépasse la taille maximale autorisée (2 Mo)" },
        { status: 400 },
      )
    }

    const extension = EXTENSION_BY_MIME_TYPE[file.type]
    if (!extension) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Type d'image non autorisé. Formats acceptés : PNG, JPG, WEBP." },
        { status: 400 },
      )
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars")
    await mkdir(uploadDir, { recursive: true })

    const storedFileName = `${randomUUID()}${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, storedFileName), buffer)

    const avatarUrl = `/uploads/avatars/${storedFileName}`

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { avatarUrl },
    })

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: "update",
      module: "users",
      entityType: "user",
      entityId: updatedUser.id,
      entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
      details: `Mise à jour de l'avatar de ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email}) par ${auth.user.email}`,
      status: "success",
    }, request)

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: sanitizeUser(updatedUser) as User,
      message: "Avatar mis à jour avec succès",
    })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors du téléversement de l'avatar" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  if (!canManageAvatar(auth.user, params.id)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Accès refusé. Vous ne pouvez modifier que votre propre avatar." },
      { status: 403 },
    )
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { avatarUrl: null },
    })

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: "update",
      module: "users",
      entityType: "user",
      entityId: updatedUser.id,
      entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
      details: `Suppression de l'avatar de ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email}) par ${auth.user.email}`,
      status: "success",
    }, request)

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: sanitizeUser(updatedUser) as User,
      message: "Avatar supprimé avec succès",
    })
  } catch (error) {
    console.error('Error deleting avatar:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la suppression de l'avatar" },
      { status: 500 },
    )
  }
}
