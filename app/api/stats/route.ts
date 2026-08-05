import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { requireAuth } from "@/lib/auth-middleware"

// GET /api/stats - Récupérer les statistiques

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    // Construire le filtre de date si nécessaire
    const dateFilter: any = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) dateFilter.lte = new Date(dateTo)
    const hasDateFilter = dateFrom || dateTo

    // Compter les banques
    const totalBanks = await prisma.bank.count({
      where: { isActive: true }
    })

    // Compter les types de cartes
    const totalCardTypes = await prisma.card.count({
      where: { isActive: true }
    })

    // Compter les emplacements
    const totalLocations = await prisma.location.count({
      where: { isActive: true }
    })

    // Compter les mouvements selon la période sélectionnée
    let movementsWhere: any = {}
    
    if (hasDateFilter) {
      // Si une période est sélectionnée, utiliser cette période
      movementsWhere.createdAt = dateFilter
    } else {
      // Sinon, utiliser aujourd'hui par défaut
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      movementsWhere.createdAt = {
        gte: today,
        lt: tomorrow
      }
    }
    
    const todayMovements = await prisma.movement.count({
      where: movementsWhere
    })

    // Total des cartes (somme des quantités)
    const cardsSum = await prisma.card.aggregate({
      _sum: {
        quantity: true
      },
      where: { isActive: true }
    })
    const totalCards = cardsSum._sum.quantity || 0

    // Cartes en stock faible (quantité < seuil minimum)
    // Récupérer toutes les cartes et filtrer côté application
    const allCards = await prisma.card.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        quantity: true,
        minThreshold: true,
        bank: { select: { id: true, name: true } },
      }
    })
    const lowStockCardsData = allCards.filter(card => card.quantity < card.minThreshold)
    const lowStockCards = lowStockCardsData.length

    // Liste des cartes en stock bas pour le widget d'alerte du tableau de bord,
    // triée par écart au seuil le plus critique (quantité - seuil le plus négatif en premier)
    const lowStockCardsList = lowStockCardsData
      .sort((a, b) => (a.quantity - a.minThreshold) - (b.quantity - b.minThreshold))
      .slice(0, 10)
      .map(card => ({
        id: card.id,
        name: card.name,
        bankName: card.bank?.name || "-",
        quantity: card.quantity,
        minThreshold: card.minThreshold,
      }))

    // Utilisateurs actifs
    const activeUsers = await prisma.user.count({
      where: { isActive: true }
    })

    // === NOUVEAUX KPIs ===
    
    // Volume total du stock (quantité totale de toutes les cartes)
    const totalStockVolume = await prisma.card.aggregate({
      _sum: {
        quantity: true
      },
      where: { isActive: true }
    })

    // Moyenne des mouvements par jour (30 derniers jours)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const movementsLast30Days = await prisma.movement.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      select: {
        movementType: true,
        quantity: true
      }
    })

    // Calculer les moyennes par type de mouvement
    const entryMovements = movementsLast30Days.filter(m => m.movementType === 'entry')
    const exitMovements = movementsLast30Days.filter(m => m.movementType === 'exit')
    const transferMovements = movementsLast30Days.filter(m => m.movementType === 'transfer')

    const avgEntryPerDay = entryMovements.length / 30
    const avgExitPerDay = exitMovements.length / 30
    const avgTransferPerDay = transferMovements.length / 30

    // Top 5 des banques avec le plus de stock
    // Si un filtre de date est appliqué, calculer le stock à la date de fin (ou aujourd'hui si pas de date de fin)
    // en ajustant le stock actuel avec les mouvements après cette date
    let banksWithStockCalculated: Array<{ id: string; name: string; totalStock: number }> = []
    
    // Déterminer la date de fin pour le calcul du stock
    const stockCalculationDate = dateTo ? new Date(dateTo) : (dateFrom ? new Date() : null)
    
    if (hasDateFilter && stockCalculationDate) {
      // Récupérer toutes les banques avec leurs cartes
      const allBanks = await prisma.bank.findMany({
        where: { isActive: true },
        include: {
          cards: {
            where: { isActive: true },
            select: {
              id: true,
              quantity: true
            }
          }
        }
      })

      // Un seul aller-retour pour tous les mouvements après la date de calcul,
      // au lieu d'une requête par carte : avec B banques et C cartes par
      // banque, la version précédente émettait jusqu'à B*C requêtes.
      const allCardIds = allBanks.flatMap(bank => bank.cards.map(card => card.id))
      const movementsAfterDate = allCardIds.length > 0
        ? await prisma.movement.findMany({
            where: {
              cardId: { in: allCardIds },
              createdAt: { gt: stockCalculationDate }
            },
            select: {
              cardId: true,
              movementType: true,
              quantity: true
            }
          })
        : []

      // Ajuster le stock en retirant les mouvements après la date : une entrée
      // après la date se retire du stock, une sortie après la date s'y ajoute
      // (elle n'avait pas encore eu lieu). Les transferts ne changent pas le
      // stock total, donc ne comptent pas.
      const adjustmentByCard = new Map<string, number>()
      movementsAfterDate.forEach(m => {
        const delta = m.movementType === 'entry' ? -m.quantity : m.movementType === 'exit' ? m.quantity : 0
        adjustmentByCard.set(m.cardId, (adjustmentByCard.get(m.cardId) || 0) + delta)
      })

      banksWithStockCalculated = allBanks.map(bank => {
        const totalStock = bank.cards.reduce((sum, card) => {
          const cardStock = card.quantity + (adjustmentByCard.get(card.id) || 0)
          return sum + Math.max(0, cardStock)
        }, 0)

        return {
          id: bank.id,
          name: bank.name,
          totalStock
        }
      })
    } else {
      // Utiliser le stock actuel des cartes
      const allBanksWithStock = await prisma.bank.findMany({
        where: { isActive: true },
        include: {
          cards: {
            where: { isActive: true },
            select: { quantity: true }
          }
        }
      })

      banksWithStockCalculated = allBanksWithStock.map(bank => ({
        id: bank.id,
        name: bank.name,
        totalStock: bank.cards.reduce((sum, card) => sum + card.quantity, 0)
      }))
    }

    // Trier par stock total décroissant et prendre le top 5
    const topBanksWithStock = banksWithStockCalculated
      .sort((a, b) => b.totalStock - a.totalStock)
      .slice(0, 5)

    // Trier par stock total croissant et prendre le top 5 (moins de stock)
    const bottomBanksWithStock = banksWithStockCalculated
      .sort((a, b) => a.totalStock - b.totalStock)
      .slice(0, 5)

    // Banques en stock minimum (quantité < seuil minimum)
    const banksWithLowStock = await prisma.bank.findMany({
      where: { isActive: true },
      include: {
        cards: {
          where: { isActive: true },
          select: { 
            name: true, 
            quantity: true, 
            minThreshold: true 
          }
        }
      }
    })

    const banksInMinStock = banksWithLowStock
      .map(bank => ({
        id: bank.id,
        name: bank.name,
        lowStockCards: bank.cards.filter(card => card.quantity < card.minThreshold)
      }))
      .filter(bank => bank.lowStockCards.length > 0)

    // Top 5 des banques avec le plus de sorties
    // Récupérer les mouvements de type "exit" avec filtre de date si applicable
    const exitMovementsWhere: any = {
      movementType: 'exit'
    }
    
    // Appliquer le filtre de date si présent
    if (hasDateFilter) {
      exitMovementsWhere.createdAt = dateFilter
    }
    
    const allExitMovements = await prisma.movement.findMany({
      where: exitMovementsWhere,
      include: {
        card: {
          include: {
            bank: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Grouper par banque et calculer le nombre de bons et la quantité totale
    const bankExitsMap = new Map<string, { id: string; name: string; numberOfBons: number; totalQuantity: number }>()
    
    allExitMovements.forEach(movement => {
      const bankId = movement.card.bank.id
      const bankName = movement.card.bank.name
      
      if (!bankExitsMap.has(bankId)) {
        bankExitsMap.set(bankId, {
          id: bankId,
          name: bankName,
          numberOfBons: 0,
          totalQuantity: 0
        })
      }
      
      const bankData = bankExitsMap.get(bankId)!
      bankData.numberOfBons += 1
      bankData.totalQuantity += movement.quantity
    })

    // Convertir en tableau, trier par quantité totale décroissante et prendre le top 5
    const topBanksWithExits = Array.from(bankExitsMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5)

    const stats = {
      totalBanks,
      totalCardTypes,
      totalLocations,
      todayMovements,
      totalCards,
      lowStockCards,
      lowStockCardsList,
      activeUsers,
      // Nouveaux KPIs
      totalStockVolume: totalStockVolume._sum.quantity || 0,
      avgEntryPerDay: Math.round(avgEntryPerDay * 100) / 100,
      avgExitPerDay: Math.round(avgExitPerDay * 100) / 100,
      avgTransferPerDay: Math.round(avgTransferPerDay * 100) / 100,
      topBanksWithStock,
      bottomBanksWithStock,
      banksInMinStock,
      topBanksWithExits
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des statistiques",
      },
      { status: 500 },
    )
  }
}
