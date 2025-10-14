import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ImportResponse } from "@/lib/api-types"
import type { CardImportRow } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

// POST /api/cards/import - Importer des cartes depuis CSV

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    const data = body.data as CardImportRow[]
    const errors: string[] = []
    let imported = 0
    let created = 0
    let updated = 0
    let rejected = 0

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      
      try {
        // Validation
        if (!row.BanqueEmettrice || !row.NomCarte || !row.Type || !row.SousType || !row.SousSousType) {
          errors.push(`Ligne ${i + 1}: Champs requis manquants`)
          continue
        }

        // Résoudre la banque: priorité BankID/ID (si correspond à une banque), sinon BanqueEmettrice (code/nom)
        let bankIdToUse: string | null = null

        // 1) Si BankID présent, l'utiliser
        const bankIdCandidate = (row as any).BankID || (row as any).BanqueID || (row as any).bankId
        if (bankIdCandidate && bankIdCandidate.trim() !== '') {
          const bankById = await prisma.bank.findUnique({ where: { id: bankIdCandidate } })
          if (!bankById) {
            errors.push(`Ligne ${i + 1}: Banque avec ID ${bankIdCandidate} non trouvée`)
            continue
          }
          bankIdToUse = bankById.id
        }

        // 2) Si pas de BankID, et si row.ID correspond à une banque (cas où l'utilisateur met l'ID banque dans ID)
        if (!bankIdToUse && row.ID && row.ID.trim() !== '') {
          const maybeBank = await prisma.bank.findUnique({ where: { id: row.ID } })
          if (maybeBank) {
            bankIdToUse = maybeBank.id
          }
        }

        // 3) Si toujours pas de bankId, chercher par code/nom BanqueEmettrice
        if (!bankIdToUse) {
          const bank = await prisma.bank.findFirst({
            where: { 
              OR: [
                { code: row.BanqueEmettrice },
                { name: row.BanqueEmettrice }
              ]
            }
          })
          if (!bank) {
            errors.push(`Ligne ${i + 1}: Banque ${row.BanqueEmettrice} non trouvée`)
            continue
          }
          bankIdToUse = bank.id
        }

        // Si un ID est fourni et non vide, tenter de mettre à jour la carte existante
        if (row.ID && row.ID.trim() !== '') {
          const existingCard = await prisma.card.findUnique({ where: { id: row.ID } })

          if (existingCard) {
            await prisma.card.update({
              where: { id: row.ID },
              data: {
                name: row.NomCarte,
                type: row.Type,
                subType: row.SousType,
                subSubType: row.SousSousType,
                bankId: bankIdToUse!,
              }
            })
            updated++
          } else {
            // L'ID fourni ne correspond pas à une carte: si c'est un ID banque (géré plus haut), on crée une nouvelle carte
            await prisma.card.create({
              data: {
                name: row.NomCarte,
                type: row.Type,
                subType: row.SousType,
                subSubType: row.SousSousType,
                bankId: bankIdToUse!,
                quantity: 0,
                minThreshold: 50,
                maxThreshold: 100000,
                isActive: true,
              }
            })
            created++
          }
        } else {
          // Pas d'ID carte fourni: tenter d'abord de trouver une carte existante avec
          // même (bankId, name, type, subType, subSubType), sinon créer
          const existingByFields = await prisma.card.findFirst({
            where: {
              bankId: bankIdToUse!,
              name: row.NomCarte,
              type: row.Type,
              subType: row.SousType,
              subSubType: row.SousSousType,
            }
          })

          if (existingByFields) {
            await prisma.card.update({
              where: { id: existingByFields.id },
              data: {
                // On met à jour les mêmes champs (utile si casse/espaces diffèrent)
                name: row.NomCarte,
                type: row.Type,
                subType: row.SousType,
                subSubType: row.SousSousType,
                bankId: bankIdToUse!,
              }
            })
            updated++
          } else {
            // Créer une nouvelle carte
            await prisma.card.create({
              data: {
                name: row.NomCarte,
                type: row.Type,
                subType: row.SousType,
                subSubType: row.SousSousType,
                bankId: bankIdToUse!,
                quantity: 0,
                minThreshold: 50,
                maxThreshold: 100000,
                isActive: true,
              }
            })
            created++
          }
        }

        imported++
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
        module: "cards",
        entityType: "card",
        entityName: "Import CSV",
        details: `Import CSV de ${imported} carte(s): ${created} créée(s), ${updated} mise(s) à jour, ${rejected} rejetée(s)`,
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
      message: `Import terminé: ${created} créée(s), ${updated} mise(s) à jour, ${rejected} rejetée(s)`
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