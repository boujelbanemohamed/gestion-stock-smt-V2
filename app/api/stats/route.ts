import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"

// GET /api/stats - Récupérer les statistiques

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
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
      select: { quantity: true, minThreshold: true }
    })
    const lowStockCards = allCards.filter(card => card.quantity < card.minThreshold).length

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
        type: true,
        quantity: true
      }
    })

    // Calculer les moyennes par type de mouvement
    const entryMovements = movementsLast30Days.filter(m => m.type === 'entry')
    const exitMovements = movementsLast30Days.filter(m => m.type === 'exit')
    const transferMovements = movementsLast30Days.filter(m => m.type === 'transfer')

    const avgEntryPerDay = entryMovements.length / 30
    const avgExitPerDay = exitMovements.length / 30
    const avgTransferPerDay = transferMovements.length / 30

    // Top 3 des banques avec le plus de stock
    const banksWithMostStock = await prisma.bank.findMany({
      where: { isActive: true },
      include: {
        cards: {
          where: { isActive: true },
          select: { quantity: true }
        }
      },
      orderBy: {
        cards: {
          _count: 'desc'
        }
      },
      take: 3
    })

    const topBanksWithStock = banksWithMostStock.map(bank => ({
      id: bank.id,
      name: bank.name,
      totalStock: bank.cards.reduce((sum, card) => sum + card.quantity, 0)
    }))

    // Top 3 des banques avec le moins de stock
    const banksWithLeastStock = await prisma.bank.findMany({
      where: { isActive: true },
      include: {
        cards: {
          where: { isActive: true },
          select: { quantity: true }
        }
      },
      orderBy: {
        cards: {
          _count: 'asc'
        }
      },
      take: 3
    })

    const bottomBanksWithStock = banksWithLeastStock.map(bank => ({
      id: bank.id,
      name: bank.name,
      totalStock: bank.cards.reduce((sum, card) => sum + card.quantity, 0)
    }))

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

    const stats = {
      totalBanks,
      totalCardTypes,
      totalLocations,
      todayMovements,
      totalCards,
      lowStockCards,
      activeUsers,
      // Nouveaux KPIs
      totalStockVolume: totalStockVolume._sum.quantity || 0,
      avgEntryPerDay: Math.round(avgEntryPerDay * 100) / 100,
      avgExitPerDay: Math.round(avgExitPerDay * 100) / 100,
      avgTransferPerDay: Math.round(avgTransferPerDay * 100) / 100,
      topBanksWithStock,
      bottomBanksWithStock,
      banksInMinStock
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
