import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ImportResponse } from "@/lib/api-types"
import type { BankImportRow } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

// POST /api/banks/import - Importer des banques depuis CSV
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

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

    const data = body.data as BankImportRow[]
    const errors: string[] = []
    let imported = 0

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      
      try {
        // Validation
        if (!row.CodeBanque || !row.NomBanque || !row.Pays || !row.SwiftCode) {
          errors.push(`Ligne ${i + 1}: Champs requis manquants`)
          continue
        }

        // Si un ID est fourni et non vide, mettre à jour la banque existante
        if (row.ID && row.ID.trim() !== '') {
          const existing = await prisma.bank.findUnique({
            where: { id: row.ID }
          })

          if (!existing) {
            errors.push(`Ligne ${i + 1}: Banque avec ID ${row.ID} non trouvée`)
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
        } else {
          // Vérifier si la banque existe déjà par code
          const existing = await prisma.bank.findUnique({
            where: { code: row.CodeBanque }
          })

          if (existing) {
            errors.push(`Ligne ${i + 1}: Banque ${row.CodeBanque} existe déjà`)
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
        }

        imported++
      } catch (error) {
        errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
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
      errors,
    })
  } catch (error) {
    console.error('Import banks error:', error)
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