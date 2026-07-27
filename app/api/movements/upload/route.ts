import { type NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import type { ApiResponse } from "@/lib/api-types"
import { requireAuth } from "@/lib/auth-middleware"

// POST /api/movements/upload - Téléverse un document justificatif pour un mouvement d'entrée

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 Mo

// On dérive l'extension du type MIME plutôt que du nom de fichier fourni par le
// client, pour ne jamais écrire sur disque un nom de fichier non maîtrisé.
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
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
        { success: false, error: "Le fichier dépasse la taille maximale autorisée (5 Mo)" },
        { status: 400 },
      )
    }

    const extension = EXTENSION_BY_MIME_TYPE[file.type]
    if (!extension) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Type de fichier non autorisé. Formats acceptés : PDF, PNG, JPG, WEBP." },
        { status: 400 },
      )
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "movements")
    await mkdir(uploadDir, { recursive: true })

    const storedFileName = `${randomUUID()}${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, storedFileName), buffer)

    return NextResponse.json<ApiResponse<{ url: string; name: string }>>({
      success: true,
      data: {
        url: `/uploads/movements/${storedFileName}`,
        name: file.name,
      },
    })
  } catch (error) {
    console.error("Error uploading movement document:", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors du téléversement du document" },
      { status: 500 },
    )
  }
}
