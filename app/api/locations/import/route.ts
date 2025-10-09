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
    let created = 0
    let updated = 0
    let rejected = 0

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      
      try {
        // Validation
        if (!row.Banque || !row.NomEmplacement) {
          errors.push(`Ligne ${i + 1}: Champs requis manquants`)
          rejected++
          continue
        }

        // Trouver la banque par code OU nom
        const bank = await prisma.bank.findFirst({
          where: { 
            OR: [
              { code: row.Banque },
              { name: row.Banque }
            ]
          }
        })

        if (!bank) {
          errors.push(`Ligne ${i + 1}: Banque ${row.Banque} non trouvée`)
          rejected++
          continue
        }

        // Vérifier si l'emplacement existe déjà (même nom + même banque)
        const existing = await prisma.location.findFirst({
          where: {
            name: row.NomEmplacement,
            bankId: bank.id
          }
        })

        if (existing) {
          // Mettre à jour l'emplacement existant
          await prisma.location.update({
            where: { id: existing.id },
            data: {
              description: row.Description || null,
            }
          })
          updated++
        } else {
          // Créer un nouvel emplacement
          await prisma.location.create({
            data: {
              name: row.NomEmplacement,
              description: row.Description || null,
              bankId: bank.id,
              isActive: true,
            }
          })
          created++
        }

        imported++
      } catch (error) {
        errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
        rejected++
      }
    }

    return NextResponse.json<ImportResponse>({
      success: errors.length === 0,
      imported,
      created,
      updated,
      rejected,
      errors,
      message: `Import terminé: ${created} créé(s), ${updated} mis à jour, ${rejected} rejeté(s)`
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