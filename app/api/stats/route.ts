import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"

// GET /api/stats - Récupérer les statistiques
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

    // Compter les mouvements d'aujourd'hui
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const todayMovements = await prisma.movement.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
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

    const stats = {
      totalBanks,
      totalCardTypes,
      totalLocations,
      todayMovements,
      totalCards,
      lowStockCards,
      activeUsers
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
