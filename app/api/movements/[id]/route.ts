import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Movement } from "@/lib/types"
import { requireAuth, requireAdmin } from "@/lib/auth-middleware"
import { serverEvents } from "@/lib/server-events"
import { logAudit } from "@/lib/audit-logger"

// GET /api/movements/[id] - Récupérer un mouvement par ID

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const movement = await prisma.movement.findUnique({
      where: { id: params.id },
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

    if (!movement) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Mouvement non trouvé",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Movement>>({
      success: true,
      data: movement as Movement,
    })
  } catch (error) {
    console.error('Error fetching movement:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération du mouvement",
      },
      { status: 500 },
    )
  }
}

// DELETE /api/movements/[id] - Supprimer un mouvement
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const movement = await prisma.movement.findUnique({
      where: { id: params.id },
      include: { card: true },
    })

    if (!movement) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Mouvement non trouvé",
        },
        { status: 404 },
      )
    }

    // Annule l'effet du mouvement sur le stock, puis supprime la ligne, le tout
    // dans une seule transaction : sans cela la suppression laissait le stock
    // gonflé (ou creusé) et l'historique devenait incohérent avec les
    // stock_levels. L'inverse d'une entrée est un retrait à la destination,
    // celui d'une sortie un retour à la source, celui d'un transfert les deux.
    try {
      await prisma.$transaction(async (tx) => {
        const annuler = async (locationId: string, delta: number) => {
          const existant = await tx.stockLevel.findFirst({
            where: { cardId: movement.cardId, locationId },
          })
          const nouvelleQuantite = (existant?.quantity ?? 0) + delta
          if (nouvelleQuantite < 0) {
            throw new Error(
              "Annuler ce mouvement rendrait le stock négatif à l'un des emplacements concernés " +
                "(des mouvements postérieurs ont déjà consommé ces cartes).",
            )
          }
          if (!existant) {
            await tx.stockLevel.create({
              data: { cardId: movement.cardId, locationId, quantity: nouvelleQuantite },
            })
          } else {
            await tx.stockLevel.update({
              where: { id: existant.id },
              data: { quantity: nouvelleQuantite },
            })
          }
        }

        if (movement.movementType === "entry" && movement.toLocationId) {
          await annuler(movement.toLocationId, -movement.quantity)
        } else if (movement.movementType === "exit" && movement.fromLocationId) {
          await annuler(movement.fromLocationId, +movement.quantity)
        } else if (movement.movementType === "transfer") {
          if (movement.toLocationId) await annuler(movement.toLocationId, -movement.quantity)
          if (movement.fromLocationId) await annuler(movement.fromLocationId, +movement.quantity)
        }

        await tx.movement.delete({ where: { id: params.id } })

        // Resynchronise le compteur dénormalisé card.quantity sur la somme réelle
        // des stock_levels, comme le fait la création de mouvement.
        const agg = await tx.stockLevel.aggregate({
          where: { cardId: movement.cardId },
          _sum: { quantity: true },
        })
        await tx.card.update({
          where: { id: movement.cardId },
          data: { quantity: agg._sum.quantity ?? 0 },
        })
      })
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes("stock négatif")
          ? error.message
          : "Erreur lors de l'annulation du mouvement"
      return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 409 })
    }

    // Pousse la suppression en temps réel (SSE) aux clients connectés.
    serverEvents.emit("movement", { action: "deleted", movementId: params.id })

    const movementTypeLabels: Record<string, string> = { entry: "Entrée", exit: "Sortie", transfer: "Transfert" }
    const movementTypeLabel = movementTypeLabels[movement.movementType] || movement.movementType
    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: "delete",
      module: "movements",
      entityType: "movement",
      entityId: movement.id,
      entityName: `${movementTypeLabel} - ${movement.card.name}`,
      details: `Suppression du mouvement ${movementTypeLabel}: ${movement.quantity} x ${movement.card.name} par ${auth.user.email}`,
      status: "success",
    }, request)

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Mouvement supprimé avec succès",
    })
  } catch (error) {
    console.error('Error deleting movement:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression du mouvement",
      },
      { status: 500 },
    )
  }
}