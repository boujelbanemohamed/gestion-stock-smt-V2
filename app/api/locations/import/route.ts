import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ImportResponse } from "@/lib/api-types"
import type { LocationImportRow } from "@/lib/types"

// POST /api/locations/import - Importer des emplacements depuis CSV
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.data || !Array.isArray(body.data)) {
      return NextResponse.json<ImportResponse>(
        {
          success: false,
          imported: 0,
          errors: ["Format de données invalide. Un tableau est attendu."],
        },
        { status: 400 },
      )
    }

    const result = dataStore.importLocations(body.data as LocationImportRow[])

    return NextResponse.json<ImportResponse>({
      success: result.errors.length === 0,
      imported: result.success.length,
      errors: result.errors,
    })
  } catch (error) {
    return NextResponse.json<ImportResponse>(
      {
        success: false,
        imported: 0,
        errors: ["Erreur lors de l'import des emplacements"],
      },
      { status: 500 },
    )
  }
}
