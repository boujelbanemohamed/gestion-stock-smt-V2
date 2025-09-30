import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Movement } from "@/lib/types"

// GET /api/movements - Récupérer tous les mouvements
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cardId = searchParams.get("cardId")
    const locationId = searchParams.get("locationId")
    const movementType = searchParams.get("type")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    const where: any = {}

    if (cardId) where.cardId = cardId
    if (movementType) where.movementType = movementType
    
    if (locationId) {
      where.OR = [
        { fromLocationId: locationId },
        { toLocationId: locationId }
      ]
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const movements = await prisma.movement.findMany({
      where,
      include: {
        card: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          }
        },
        fromLocation: true,
        toLocation: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json<ApiResponse<Movement[]>>({
      success: true,
      data: movements as Movement[],
    })
  } catch (error) {
    console.error('Error fetching movements:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des mouvements",
      },
      { status: 500 },
    )
  }
}

// POST /api/movements - Créer un nouveau mouvement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validation des champs requis
    if (!body.cardId || !body.movementType || !body.quantity || !body.userId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Champs requis manquants: cardId, movementType, quantity, userId",
        },
        { status: 400 },
      )
    }

    // Validation du type de mouvement
    if (!['entry', 'exit', 'transfer'].includes(body.movementType)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Type de mouvement invalide (entry, exit, ou transfer)",
        },
        { status: 400 },
      )
    }

    const newMovement = await prisma.movement.create({
      data: {
        cardId: body.cardId,
        fromLocationId: body.fromLocationId || null,
        toLocationId: body.toLocationId || null,
        movementType: body.movementType,
        quantity: body.quantity,
        reason: body.reason || "",
        userId: body.userId,
      },
      include: {
        card: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          }
        },
        fromLocation: true,
        toLocation: true,
      }
    })

    return NextResponse.json<ApiResponse<Movement>>(
      {
        success: true,
        data: newMovement as Movement,
        message: "Mouvement créé avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating movement:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création du mouvement",
      },
      { status: 500 },
    )
  }
}