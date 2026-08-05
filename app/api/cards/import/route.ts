import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ImportResponse } from "@/lib/api-types"
import type { CardImportRow } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAdmin } from "@/lib/auth-middleware"

// POST /api/cards/import - Importer des cartes depuis CSV

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
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

    const data = body.data as CardImportRow[]
    const errors: string[] = []
    let imported = 0
    let created = 0
    let updated = 0
    let rejected = 0

    // Résolution des banques et cartes en mémoire (une seule lecture de
    // chacune des deux tables au démarrage) au lieu d'aller chercher chaque
    // banque et chaque carte en base à chaque ligne : la version précédente
    // émettait jusqu'à 2-6 requêtes séquentielles par ligne. On ne remplace
    // pas les écritures (create/update) par un traitement en masse : chaque
    // ligne doit pouvoir échouer indépendamment sans faire échouer les
    // autres (import CSV = succès partiel attendu), ce qui empêche aussi de
    // tout envelopper dans une seule transaction Postgres (une erreur y
    // rendrait toutes les lignes suivantes invalides).
    const allBanks = await prisma.bank.findMany()
    const bankById = new Map(allBanks.map(b => [b.id, b]))
    const bankByCodeOrName = new Map<string, typeof allBanks[number]>()
    allBanks.forEach(b => {
      bankByCodeOrName.set(b.code, b)
      bankByCodeOrName.set(b.name, b)
    })

    const tupleKey = (bankId: string, name: string, type: string, subType: string, subSubType: string) =>
      `${bankId}::${name}::${type}::${subType}::${subSubType}`

    const existingCards = await prisma.card.findMany()
    const cardById = new Map(existingCards.map(c => [c.id, c]))
    const cardByTuple = new Map(
      existingCards.map(c => [tupleKey(c.bankId, c.name, c.type, c.subType, c.subSubType), c]),
    )

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
          const bankByIdMatch = bankById.get(bankIdCandidate)
          if (!bankByIdMatch) {
            errors.push(`Ligne ${i + 1}: Banque avec ID ${bankIdCandidate} non trouvée`)
            continue
          }
          bankIdToUse = bankByIdMatch.id
        }

        // 2) Si pas de BankID, et si row.ID correspond à une banque (cas où l'utilisateur met l'ID banque dans ID)
        if (!bankIdToUse && row.ID && row.ID.trim() !== '') {
          const maybeBank = bankById.get(row.ID)
          if (maybeBank) {
            bankIdToUse = maybeBank.id
          }
        }

        // 3) Si toujours pas de bankId, chercher par code/nom BanqueEmettrice
        if (!bankIdToUse) {
          const bank = bankByCodeOrName.get(row.BanqueEmettrice)
          if (!bank) {
            errors.push(`Ligne ${i + 1}: Banque ${row.BanqueEmettrice} non trouvée`)
            continue
          }
          bankIdToUse = bank.id
        }

        // Si un ID est fourni et non vide, tenter de mettre à jour la carte existante
        if (row.ID && row.ID.trim() !== '') {
          const existingCard = cardById.get(row.ID)

          if (existingCard) {
            const updatedCard = await prisma.card.update({
              where: { id: row.ID },
              data: {
                name: row.NomCarte,
                type: row.Type,
                subType: row.SousType,
                subSubType: row.SousSousType,
                bankId: bankIdToUse!,
              }
            })
            cardById.set(updatedCard.id, updatedCard)
            cardByTuple.set(
              tupleKey(updatedCard.bankId, updatedCard.name, updatedCard.type, updatedCard.subType, updatedCard.subSubType),
              updatedCard,
            )
            updated++
          } else {
            // L'ID fourni ne correspond pas à une carte: si c'est un ID banque (géré plus haut), on crée une nouvelle carte
            const newCard = await prisma.card.create({
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
            cardById.set(newCard.id, newCard)
            cardByTuple.set(
              tupleKey(newCard.bankId, newCard.name, newCard.type, newCard.subType, newCard.subSubType),
              newCard,
            )
            created++
          }
        } else {
          // Pas d'ID carte fourni: tenter d'abord de trouver une carte existante avec
          // même (bankId, name, type, subType, subSubType), sinon créer
          const existingByFields = cardByTuple.get(
            tupleKey(bankIdToUse!, row.NomCarte, row.Type, row.SousType, row.SousSousType),
          )

          if (existingByFields) {
            const updatedCard = await prisma.card.update({
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
            cardById.set(updatedCard.id, updatedCard)
            cardByTuple.set(
              tupleKey(updatedCard.bankId, updatedCard.name, updatedCard.type, updatedCard.subType, updatedCard.subSubType),
              updatedCard,
            )
            updated++
          } else {
            // Créer une nouvelle carte
            const newCard = await prisma.card.create({
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
            cardById.set(newCard.id, newCard)
            cardByTuple.set(
              tupleKey(newCard.bankId, newCard.name, newCard.type, newCard.subType, newCard.subSubType),
              newCard,
            )
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
        created: 0,
        updated: 0,
        rejected: 0,
        errors: ["Erreur lors de l'import des cartes"],
      },
      { status: 500 },
    )
  }
}