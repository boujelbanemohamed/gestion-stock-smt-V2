import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { Card, CardFilters } from "@/lib/types"

// GET /api/cards - Récupérer toutes les cartes avec filtres optionnels
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filters: CardFilters = {}

    const bankId = searchParams.get("bankId")
    const type = searchParams.get("type")
    const subType = searchParams.get("subType")
    const subSubType = searchParams.get("subSubType")
    const lowStock = searchParams.get("lowStock")
    const searchTerm = searchParams.get("search")

    if (bankId) filters.bankId = bankId
    if (type) filters.type = type
    if (subType) filters.subType = subType
    if (subSubType) filters.subSubType = subSubType
    if (lowStock === "true") filters.lowStock = true
    if (searchTerm) filters.searchTerm = searchTerm

    const cards = Object.keys(filters).length > 0 ? dataStore.searchCards(filters) : dataStore.getCards()

    return NextResponse.json<ApiResponse<Card[]>>({
      success: true,
      data: cards,
    })
  } catch (error) {
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

    const newCard = dataStore.addCard({
      name: body.name,
      type: body.type,
      subType: body.subType,
      subSubType: body.subSubType,
      bankId: body.bankId,
      quantity: body.quantity || 0,
      minThreshold,
      maxThreshold,
      isActive: body.isActive !== undefined ? body.isActive : true,
    })

    return NextResponse.json<ApiResponse<Card>>(
      {
        success: true,
        data: newCard,
        message: "Carte créée avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
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
