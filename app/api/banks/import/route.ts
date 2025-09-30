import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ImportResponse } from "@/lib/api-types"
import type { BankImportRow } from "@/lib/types"

// POST /api/banks/import - Importer des banques depuis CSV
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

    const result = dataStore.importBanks(body.data as BankImportRow[])

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
        errors: ["Erreur lors de l'import des banques"],
      },
      { status: 500 },
    )
  }
}
