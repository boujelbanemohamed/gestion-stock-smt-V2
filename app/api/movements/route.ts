import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { Movement } from "@/lib/types"

// GET /api/movements - Récupérer tous les mouvements
export async function GET() {
  try {
    const movements = dataStore.getMovements()

    return NextResponse.json<ApiResponse<Movement[]>>({
      success: true,
      data: movements,
    })
  } catch (error) {
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
    if (!["entry", "exit", "transfer"].includes(body.movementType)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Type de mouvement invalide. Valeurs acceptées: entry, exit, transfer",
        },
        { status: 400 },
      )
    }

    // Validation des emplacements selon le type de mouvement
    if (body.movementType === "entry" && !body.toLocationId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "toLocationId requis pour un mouvement d'entrée",
        },
        { status: 400 },
      )
    }

    if (body.movementType === "exit" && !body.fromLocationId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "fromLocationId requis pour un mouvement de sortie",
        },
        { status: 400 },
      )
    }

    if (body.movementType === "transfer" && (!body.fromLocationId || !body.toLocationId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "fromLocationId et toLocationId requis pour un transfert",
        },
        { status: 400 },
      )
    }

    const newMovement = dataStore.addMovement({
      cardId: body.cardId,
      fromLocationId: body.fromLocationId,
      toLocationId: body.toLocationId,
      movementType: body.movementType,
      quantity: body.quantity,
      reason: body.reason || "",
      userId: body.userId,
    })

    return NextResponse.json<ApiResponse<Movement>>(
      {
        success: true,
        data: newMovement,
        message: "Mouvement créé avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création du mouvement",
      },
      { status: 500 },
    )
  }
}
