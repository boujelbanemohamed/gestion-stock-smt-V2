import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Card } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

// GET /api/cards - Récupérer toutes les cartes avec filtres optionnels
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const bankId = searchParams.get("bankId")
    const type = searchParams.get("type")
    const subType = searchParams.get("subType")
    const subSubType = searchParams.get("subSubType")
    const lowStock = searchParams.get("lowStock")
    const searchTerm = searchParams.get("search")

    const where: any = {
      isActive: true // Par défaut, afficher uniquement les cartes actives
    }

    if (bankId) where.bankId = bankId
    if (type) where.type = type
    if (subType) where.subType = subType
    if (subSubType) where.subSubType = subSubType
    
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { type: { contains: searchTerm, mode: 'insensitive' } },
        { subType: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    let cards = await prisma.card.findMany({
      where,
      include: {
        bank: true,
        stockLevels: {
          include: {
            location: {
              select: { id: true, name: true, bankId: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Harmoniser la quantité: somme des stocks par emplacement
    const normalized = cards.map((c: any) => {
      const sum = (c.stockLevels || []).reduce((acc: number, sl: any) => acc + (sl.quantity || 0), 0)
      return { ...c, quantity: sum }
    })

    // Filtrer les cartes en stock faible si demandé (basé sur quantité recalculée)
    const result = lowStock === "true"
      ? normalized.filter((card: any) => card.quantity < card.minThreshold)
      : normalized

    return NextResponse.json<ApiResponse<Card[]>>({
      success: true,
      data: result as Card[],
    })
  } catch (error) {
    console.error('Error fetching cards:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des cartes",
      },
      { status: 500 },
    )
  }
}

// POST /api/cards - Créer une nouvelle carte
export async function POST(request: NextRequest) {
  try {
    const body: CreateCardRequest = await request.json()

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

    // Validation des champs requis
    if (!body.name || !body.type || !body.subType || !body.subSubType || !body.bankId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Champs requis manquants: name, type, subType, subSubType, bankId",
        },
        { status: 400 },
      )
    }

    const minThreshold = body.minThreshold || 50
    const maxThreshold = body.maxThreshold || 1000

    if (minThreshold >= maxThreshold) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Le seuil minimum doit être inférieur au seuil maximum",
        },
        { status: 400 },
      )
    }

    if (minThreshold < 0 || maxThreshold < 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Les seuils doivent être positifs",
        },
        { status: 400 },
      )
    }

    const newCard = await prisma.card.create({
      data: {
        name: body.name,
        type: body.type,
        subType: body.subType,
        subSubType: body.subSubType,
        bankId: body.bankId,
        quantity: body.quantity || 0,
        minThreshold,
        maxThreshold,
        isActive: body.isActive !== undefined ? body.isActive : true,
      }
    })

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "create",
        module: "cards",
        entityType: "card",
        entityId: newCard.id,
        entityName: newCard.name,
        details: `Création de la carte ${newCard.name} (${newCard.type} - ${newCard.subType})`,
        status: "success"
      }, request)
    }

    return NextResponse.json<ApiResponse<Card>>(
      {
        success: true,
        data: newCard as Card,
        message: "Carte créée avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating card:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création de la carte",
      },
      { status: 500 },
    )
  }
}

interface CreateCardRequest {
  name: string
  type: string
  subType: string
  subSubType: string
  bankId: string
  quantity?: number
  minThreshold?: number
  maxThreshold?: number
  isActive?: boolean
}