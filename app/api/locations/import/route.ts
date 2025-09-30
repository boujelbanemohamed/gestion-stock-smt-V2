import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
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

    const data = body.data as LocationImportRow[]
    const errors: string[] = []
    let imported = 0

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      
      try {
        // Validation
        if (!row.Banque || !row.NomEmplacement) {
          errors.push(`Ligne ${i + 1}: Champs requis manquants`)
          continue
        }

        // Trouver la banque par code
        const bank = await prisma.bank.findUnique({
          where: { code: row.Banque }
        })

        if (!bank) {
          errors.push(`Ligne ${i + 1}: Banque ${row.Banque} non trouvée`)
          continue
        }

        // Créer l'emplacement
        await prisma.location.create({
          data: {
            name: row.NomEmplacement,
            description: row.Description || null,
            bankId: bank.id,
            isActive: true,
          }
        })

        imported++
      } catch (error) {
        errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
      }
    }

    return NextResponse.json<ImportResponse>({
      success: errors.length === 0,
      imported,
      errors,
    })
  } catch (error) {
    console.error('Import locations error:', error)
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