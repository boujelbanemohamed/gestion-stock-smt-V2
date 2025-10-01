import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Movement } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

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

    // Règles de présence des emplacements selon le type
    if (body.movementType === 'entry' && !body.toLocationId) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Emplacement destination requis pour une entrée" }, { status: 400 })
    }
    if (body.movementType === 'exit' && !body.fromLocationId) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Emplacement source requis pour une sortie" }, { status: 400 })
    }
    if (body.movementType === 'transfer' && (!body.fromLocationId || !body.toLocationId)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Source et destination sont requis pour un transfert" }, { status: 400 })
    }

    // Récupérer la carte
    const card = await prisma.card.findUnique({ where: { id: body.cardId } })
    if (!card) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Carte introuvable" }, { status: 404 })
    }

    // Helpers stock par emplacement via StockLevel
    const getStockLevel = async (cardId: string, locationId: string) => {
      const level = await prisma.stockLevel.findFirst({ where: { cardId, locationId } })
      return level?.quantity ?? 0
    }

    const adjustStockLevel = async (
      tx: typeof prisma,
      cardId: string,
      locationId: string,
      delta: number
    ) => {
      const existing = await tx.stockLevel.findFirst({ where: { cardId, locationId } })
      if (!existing) {
        // Si delta est négatif et pas de stock, refuser
        if (delta < 0) throw new Error("Stock insuffisant à l'emplacement")
        await tx.stockLevel.create({ data: { cardId, locationId, quantity: delta } })
      } else {
        const newQty = existing.quantity + delta
        if (newQty < 0) throw new Error("Stock insuffisant à l'emplacement")
        await tx.stockLevel.update({ where: { id: existing.id }, data: { quantity: newQty } })
      }
    }

    const newMovement = await prisma.$transaction(async (tx) => {
      // Ajustements selon le type
      if (body.movementType === 'entry') {
        // + carte, + stock destination
        await tx.card.update({ where: { id: card.id }, data: { quantity: card.quantity + body.quantity } })
        await adjustStockLevel(tx, card.id, body.toLocationId, +body.quantity)
      } else if (body.movementType === 'exit') {
        // Vérifier stocks
        const locQty = await getStockLevel(card.id, body.fromLocationId)
        if (locQty < body.quantity) {
          throw new Error("Quantité insuffisante à l'emplacement source")
        }
        if (card.quantity < body.quantity) {
          throw new Error("Quantité totale de carte insuffisante")
        }
        // - carte, - stock source
        await tx.card.update({ where: { id: card.id }, data: { quantity: card.quantity - body.quantity } })
        await adjustStockLevel(tx, card.id, body.fromLocationId, -body.quantity)
      } else if (body.movementType === 'transfer') {
        // Vérifier stock source
        const locQty = await getStockLevel(card.id, body.fromLocationId)
        if (locQty < body.quantity) {
          throw new Error("Quantité insuffisante à l'emplacement source pour le transfert")
        }
        // 0 carte, - source, + destination
        await adjustStockLevel(tx, card.id, body.fromLocationId, -body.quantity)
        await adjustStockLevel(tx, card.id, body.toLocationId, +body.quantity)
      }

      // Créer le mouvement
      const created = await tx.movement.create({
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

      return created
    })

    // Logger la création du mouvement
    const movementTypeLabel = { entry: "Entrée", exit: "Sortie", transfer: "Transfert" }[body.movementType] || body.movementType
    await logAudit({
      userId: newMovement.user.id,
      userEmail: newMovement.user.email,
      action: "create",
      module: "movements",
      entityType: "movement",
      entityId: newMovement.id,
      entityName: `${movementTypeLabel} - ${newMovement.card.name}`,
      details: `Mouvement de type ${movementTypeLabel}: ${newMovement.quantity} x ${newMovement.card.name}. Raison: ${newMovement.reason}`,
      status: "success"
    }, request)

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