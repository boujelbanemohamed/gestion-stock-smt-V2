import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { requireAuth } from "@/lib/auth-middleware"

// POST /api/statistics/calculate - Calculer les statistiques personnalisées
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    
    const {
      dateFrom,
      dateTo,
      bankId,
      movementType,
      fromLocationId,
      toLocationId,
    } = body

    // Construire le filtre pour les mouvements
    const where: any = {}

    // Filtre par période
    if (dateFrom || dateTo) {
      const createdAtFilter: any = {}
      if (dateFrom) {
        createdAtFilter.gte = new Date(dateFrom)
      }
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999) // Inclure toute la journée
        createdAtFilter.lte = toDate
      }
      where.createdAt = createdAtFilter
    } else if (!bankId || bankId === "all") {
      // Aucune période NI banque fournie : sans borne, cette requête chargerait
      // l'intégralité de la table des mouvements en mémoire pour l'agrégation
      // en JS ci-dessous. On limite alors implicitement aux 12 derniers mois,
      // qui reste le cas d'usage normal de cet écran.
      where.createdAt = { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
    }

    // Filtre par banque (via la carte)
    if (bankId && bankId !== "all") {
      where.card = {
        bankId: bankId
      }
    }

    // Filtre par type de mouvement
    if (movementType && movementType !== "all") {
      where.movementType = movementType
    }

    // Note: On ne filtre PAS par emplacement ici car on veut TOUS les mouvements
    // qui impliquent ces emplacements (soit comme source, soit comme destination)
    // Le filtrage se fera après la récupération des mouvements

    // Construire le filtre pour la carte si nécessaire
    if (bankId && bankId !== "all") {
      // Utiliser le filtre relationnel Prisma
      where.card = {
        bankId: bankId
      }
    }

    // Récupérer tous les mouvements correspondant aux critères avec les détails des cartes et banques
    // On récupère TOUS les mouvements de la période (sans filtrer par emplacement dans la requête)
    // car on veut compter tous les mouvements qui impliquent les emplacements sélectionnés
    let movements = await prisma.movement.findMany({
      where,
      include: {
        card: {
          include: {
            bank: true
          }
        }
      }
    })

    // Filtrer par banque si nécessaire (après récupération car le filtre relationnel peut être complexe)
    if (bankId && bankId !== "all") {
      movements = movements.filter(m => m.card.bankId === bankId)
    }

    // IMPORTANT: On garde TOUS les mouvements de la période sans filtrer par emplacement
    // On comptera ensuite seulement ceux qui vont VERS les emplacements sélectionnés
    // Cela permet de compter TOUS les mouvements vers un emplacement, même s'ils viennent d'emplacements différents

    // Calculer la quantité totale de l'emplacement De (global)
    // La quantité De = somme de TOUS les mouvements où l'emplacement De est la DESTINATION (toLocationId)
    // Exemple : si De = X, on compte TOUS les mouvements où toLocationId = X (transferts VERS X)
    // Peu importe la source (fromLocationId), on compte tous les mouvements VERS cet emplacement
    let quantiteDe = 0
    
    if (fromLocationId && fromLocationId !== "all") {
      // Compter TOUS les mouvements qui vont VERS l'emplacement De (peu importe d'où ils viennent)
      quantiteDe = movements
        .filter(m => m.toLocationId === fromLocationId)
        .reduce((sum, m) => sum + m.quantity, 0)
    }

    // Calculer la quantité totale de l'emplacement Vers (global)
    // La quantité Vers = somme de TOUS les mouvements où l'emplacement Vers est la DESTINATION (toLocationId)
    // Exemple : si Vers = Y, on compte TOUS les mouvements où toLocationId = Y (transferts VERS Y)
    // Peu importe la source (fromLocationId), on compte tous les mouvements VERS cet emplacement
    let quantiteVers = 0
    
    if (toLocationId && toLocationId !== "all") {
      // Compter TOUS les mouvements qui vont VERS l'emplacement Vers (peu importe d'où ils viennent)
      quantiteVers = movements
        .filter(m => m.toLocationId === toLocationId)
        .reduce((sum, m) => sum + m.quantity, 0)
    }

    // Calculer le pourcentage global : (Quantité Vers / (Quantité Vers + Quantité De)) * 100
    const total = quantiteDe + quantiteVers
    let pourcentage = 0

    if (total > 0) {
      pourcentage = (quantiteVers / total) * 100
    }

    // Statistiques détaillées par date, banque, type de mouvement et type de carte
    interface DetailStats {
      date: string // Format: YYYY-MM-DD
      bankId: string
      bankName: string
      bankCode: string
      movementType: string
      cardType: string
      quantiteDe: number
      quantiteVers: number
    }

    const detailsByDate: DetailStats[] = []

    // Calculer les statistiques par banque
    const statsByBank: Record<string, {
      bankId: string
      bankName: string
      bankCode: string
      quantiteDe: number
      quantiteVers: number
      total: number
      pourcentage: number
      statsByCardType: Record<string, {
        cardType: string
        quantiteDe: number
        quantiteVers: number
        total: number
        pourcentage: number
      }>
    }> = {}

    movements.forEach(movement => {
      const bank = movement.card.bank
      const bankKey = bank.id

      if (!statsByBank[bankKey]) {
        statsByBank[bankKey] = {
          bankId: bank.id,
          bankName: bank.name,
          bankCode: bank.code,
          quantiteDe: 0,
          quantiteVers: 0,
          total: 0,
          pourcentage: 0,
          statsByCardType: {}
        }
      }

      // Calculer par type de carte
      const cardType = movement.card.type || "Type non spécifié"
      
      if (!statsByBank[bankKey].statsByCardType[cardType]) {
        statsByBank[bankKey].statsByCardType[cardType] = {
          cardType,
          quantiteDe: 0,
          quantiteVers: 0,
          total: 0,
          pourcentage: 0
        }
      }

      // Calculer les quantités pour chaque emplacement
      let quantiteDeForMovement = 0
      let quantiteVersForMovement = 0

      // Quantité De = TOUS les mouvements où l'emplacement De est la DESTINATION (toLocationId)
      // Exemple : si De = X, on compte TOUS les mouvements où toLocationId = X (peu importe la source)
      if (fromLocationId && fromLocationId !== "all") {
        if (movement.toLocationId === fromLocationId) {
          quantiteDeForMovement = movement.quantity
          statsByBank[bankKey].quantiteDe += movement.quantity
          statsByBank[bankKey].statsByCardType[cardType].quantiteDe += movement.quantity
        }
      }

      // Quantité Vers = TOUS les mouvements où l'emplacement Vers est la DESTINATION (toLocationId)
      // Exemple : si Vers = Y, on compte TOUS les mouvements où toLocationId = Y (peu importe la source)
      if (toLocationId && toLocationId !== "all") {
        if (movement.toLocationId === toLocationId) {
          quantiteVersForMovement = movement.quantity
          statsByBank[bankKey].quantiteVers += movement.quantity
          statsByBank[bankKey].statsByCardType[cardType].quantiteVers += movement.quantity
        }
      }

      // Ajouter les détails par date seulement pour les mouvements qui vont VERS les emplacements sélectionnés
      if (quantiteDeForMovement > 0 || quantiteVersForMovement > 0) {
        const dateStr = new Date(movement.createdAt).toISOString().split('T')[0] // Format YYYY-MM-DD
        const movementTypeLabel = movement.movementType === 'entry' ? 'Entrée' : 
                                  movement.movementType === 'exit' ? 'Sortie' : 
                                  'Transfert'

        detailsByDate.push({
          date: dateStr,
          bankId: bank.id,
          bankName: bank.name,
          bankCode: bank.code,
          movementType: movementTypeLabel,
          cardType: cardType,
          quantiteDe: quantiteDeForMovement,
          quantiteVers: quantiteVersForMovement,
        })
      }
    })

    // Calculer les totaux et pourcentages pour chaque banque et type de carte
    // Formule: (Quantité Vers / (Quantité Vers + Quantité De)) * 100
    Object.keys(statsByBank).forEach(bankKey => {
      const bankStats = statsByBank[bankKey]
      bankStats.total = bankStats.quantiteDe + bankStats.quantiteVers
      bankStats.pourcentage = bankStats.total > 0 ? (bankStats.quantiteVers / bankStats.total) * 100 : 0

      // Calculer pour chaque type de carte
      Object.keys(bankStats.statsByCardType).forEach(cardType => {
        const cardStats = bankStats.statsByCardType[cardType]
        cardStats.total = cardStats.quantiteDe + cardStats.quantiteVers
        cardStats.pourcentage = cardStats.total > 0 ? (cardStats.quantiteVers / cardStats.total) * 100 : 0
      })
    })

    // Récupérer les noms des emplacements pour l'affichage
    let fromLocationName = null
    let toLocationName = null

    if (fromLocationId && fromLocationId !== "all") {
      const fromLoc = await prisma.location.findUnique({
        where: { id: fromLocationId },
        select: { name: true }
      })
      fromLocationName = fromLoc?.name || null
    }

    if (toLocationId && toLocationId !== "all") {
      const toLoc = await prisma.location.findUnique({
        where: { id: toLocationId },
        select: { name: true }
      })
      toLocationName = toLoc?.name || null
    }

    // Trier les détails par date (croissant)
    detailsByDate.sort((a, b) => a.date.localeCompare(b.date))

    // Calculer les sommes totales par emplacement dans les détails
    const totalDetailsDe = detailsByDate.reduce((sum, d) => sum + d.quantiteDe, 0)
    const totalDetailsVers = detailsByDate.reduce((sum, d) => sum + d.quantiteVers, 0)

    const result = {
      quantiteDe,
      quantiteVers,
      total,
      pourcentage: Math.round(pourcentage * 100) / 100, // Arrondir à 2 décimales
      fromLocationName,
      toLocationName,
      nombreMouvements: movements.length,
      statsByBank: Object.values(statsByBank).map(bank => ({
        ...bank,
        pourcentage: Math.round(bank.pourcentage * 100) / 100,
        statsByCardType: Object.values(bank.statsByCardType).map(card => ({
          ...card,
          pourcentage: Math.round(card.pourcentage * 100) / 100,
        }))
      })),
      detailsByDate: detailsByDate,
      totalDetailsDe,
      totalDetailsVers,
      filtres: {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        bankId: bankId || null,
        movementType: movementType || null,
        fromLocationId: fromLocationId || null,
        toLocationId: toLocationId || null,
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error calculating statistics:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors du calcul des statistiques",
      },
      { status: 500 },
    )
  }
}

