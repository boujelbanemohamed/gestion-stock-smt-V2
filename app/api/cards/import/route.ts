import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ImportResponse } from "@/lib/api-types"
import type { CardImportRow } from "@/lib/types"

// POST /api/cards/import - Importer des cartes depuis CSV
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

    const data = body.data as CardImportRow[]
    const errors: string[] = []
    let imported = 0

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      
      try {
        // Validation
        if (!row.BanqueEmettrice || !row.NomCarte || !row.Type || !row.SousType || !row.SousSousType) {
          errors.push(`Ligne ${i + 1}: Champs requis manquants`)
          continue
        }

        // Trouver la banque par code
        const bank = await prisma.bank.findUnique({
          where: { code: row.BanqueEmettrice }
        })

        if (!bank) {
          errors.push(`Ligne ${i + 1}: Banque ${row.BanqueEmettrice} non trouvée`)
          continue
        }

        // Créer la carte
        await prisma.card.create({
          data: {
            name: row.NomCarte,
            type: row.Type,
            subType: row.SousType,
            subSubType: row.SousSousType,
            bankId: bank.id,
            quantity: 0,
            minThreshold: 50,
            maxThreshold: 1000,
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
    console.error('Import cards error:', error)
    return NextResponse.json<ImportResponse>(
      {
        success: false,
        imported: 0,
        errors: ["Erreur lors de l'import des cartes"],
      },
      { status: 500 },
    )
  }
}