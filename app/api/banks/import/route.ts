import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ImportResponse } from "@/lib/api-types"
import type { BankImportRow } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAuth } from "@/lib/auth-middleware"

// POST /api/banks/import - Importer des banques depuis CSV

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()

    const userData = auth.user

    if (!body.data || !Array.isArray(body.data)) {
      return NextResponse.json<ImportResponse>(
        {
          success: false,
          imported: 0,
          created: 0,
          updated: 0,
          rejected: 0,
          errors: ["Format de données invalide. Un tableau est attendu."],
        },
        { status: 400 },
      )
    }

    const data = body.data as BankImportRow[]
    const errors: string[] = []
    let imported = 0
    let created = 0
    let updated = 0
    let rejected = 0

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      
      try {
        // Validation
        if (!row.CodeBanque || !row.NomBanque || !row.Pays || !row.SwiftCode) {
          errors.push(`Ligne ${i + 1}: Champs requis manquants`)
          rejected++
          continue
        }

        // Si un ID est fourni et non vide, mettre à jour la banque existante
        if (row.ID && row.ID.trim() !== '') {
          const existing = await prisma.bank.findUnique({
            where: { id: row.ID }
          })

          if (!existing) {
            errors.push(`Ligne ${i + 1}: Banque avec ID ${row.ID} non trouvée`)
            rejected++
            continue
          }

          // Mettre à jour la banque existante
          await prisma.bank.update({
            where: { id: row.ID },
            data: {
              code: row.CodeBanque,
              name: row.NomBanque,
              country: row.Pays,
              swiftCode: row.SwiftCode,
              address: row.Adresse || "",
              phone: row.Telephone || "",
              email: row.Email || "",
            }
          })
          updated++
          imported++
        } else {
          // Vérifier si la banque existe déjà par code
          const existing = await prisma.bank.findUnique({
            where: { code: row.CodeBanque }
          })

          if (existing) {
            errors.push(`Ligne ${i + 1}: Banque ${row.CodeBanque} existe déjà`)
            rejected++
            continue
          }

          // Créer une nouvelle banque
          await prisma.bank.create({
            data: {
              code: row.CodeBanque,
              name: row.NomBanque,
              country: row.Pays,
              swiftCode: row.SwiftCode,
              address: row.Adresse || "",
              phone: row.Telephone || "",
              email: row.Email || "",
              isActive: true,
            }
          })
          created++
          imported++
        }
      } catch (error) {
        errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
        rejected++
      }
    }

    // Logger l'action d'import
    if (userData && imported > 0) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "create",
        module: "banks",
        entityType: "bank",
        entityName: "Import CSV",
        details: `Import CSV de ${imported} banque(s)${errors.length > 0 ? ` avec ${errors.length} erreur(s)` : ''}`,
        status: errors.length === 0 ? "success" : "success"
      }, request)
    }

    return NextResponse.json<ImportResponse>({
      success: errors.length === 0,
      imported,
      created,
      updated,
      rejected,
      errors,
    })
  } catch (error) {
    console.error('Import banks error:', error)
    return NextResponse.json<ImportResponse>(
      {
        success: false,
        imported: 0,
        created: 0,
        updated: 0,
        rejected: 0,
        errors: ["Erreur lors de l'import des banques"],
      },
      { status: 500 },
    )
  }
}
