import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Bank } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAuth, requireAdmin } from "@/lib/auth-middleware"

// GET /api/banks/[id] - Récupérer une banque spécifique
// PUT /api/banks/[id] - Mettre à jour une banque
// DELETE /api/banks/[id] - Supprimer une banque

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const { id } = params

    const bank = await prisma.bank.findUnique({
      where: { id },
      include: {
        cards: {
          select: {
            id: true,
            name: true,
            type: true,
          }
        },
        locations: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    if (!bank) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Banque non trouvée",
        },
        { status: 404 },
      )
    }

    return NextResponse.json<ApiResponse<Bank>>({
      success: true,
      data: bank as Bank,
    })
  } catch (error) {
    console.error('Error fetching bank:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de la banque",
      },
      { status: 500 },
    )
  }
}

// PUT /api/banks/[id] - Mettre à jour une banque
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    const { id } = params

    const userData = auth.user

    const updatedBank = await prisma.bank.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.code !== undefined && { code: body.code }),
        ...(body.country !== undefined && { country: body.country }),
        ...(body.swiftCode !== undefined && { swiftCode: body.swiftCode }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      }
    })

    // Logger l'action (toujours créer un log)
    await logAudit({
      userId: userData?.id || "system",
      userEmail: userData?.email || "system@monetique.tn",
      action: "update",
      module: "banks",
      entityType: "bank",
      entityId: updatedBank.id,
      entityName: updatedBank.name,
      details: `Modification de la banque ${updatedBank.name} (${updatedBank.code})${userData ? ` par ${userData.email}` : ' (utilisateur non identifié)'}`,
      status: "success"
    }, request)

    return NextResponse.json<ApiResponse<Bank>>({
      success: true,
      data: updatedBank as Bank,
      message: "Banque mise à jour avec succès"
    })
  } catch (error) {
    console.error('Error updating bank:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de la banque"
      },
      { status: 500 }
    )
  }
}

// DELETE /api/banks/[id] - Supprimer une banque
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const { id } = params

    const userData = auth.user

    // Récupérer les infos de la banque avant suppression
    const bank = await prisma.bank.findUnique({
      where: { id }
    })

    if (!bank) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Banque non trouvée",
        },
        { status: 404 },
      )
    }

    // Cartes, emplacements et inventaires sont en cascade sur la banque au
    // niveau du schéma : sans ce contrôle, une seule suppression effacerait
    // silencieusement tout leur historique (y compris les mouvements, en
    // cascade sur la carte). cards/[id] et locations/[id] bloquent déjà leur
    // propre suppression tant qu'ils contiennent du stock ou des mouvements ;
    // on applique la même règle ici, au niveau de la banque.
    const [cardsCount, locationsCount, inventoriesCount] = await Promise.all([
      prisma.card.count({ where: { bankId: id } }),
      prisma.location.count({ where: { bankId: id } }),
      prisma.inventory.count({ where: { bankId: id } }),
    ])

    if (cardsCount > 0 || locationsCount > 0 || inventoriesCount > 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Impossible de supprimer cette banque : elle est encore associée à ${cardsCount} carte(s), ${locationsCount} emplacement(s) et ${inventoriesCount} inventaire(s). Veuillez d'abord les supprimer.`,
        },
        { status: 400 },
      )
    }

    await prisma.bank.delete({
      where: { id }
    })

    await logAudit({
      userId: userData?.id || "system",
      userEmail: userData?.email || "system@monetique.tn",
      action: "delete",
      module: "banks",
      entityType: "bank",
      entityId: id,
      entityName: bank.name,
      details: `Suppression de la banque ${bank.name} (${bank.code})${userData ? ` par ${userData.email}` : ' (utilisateur non identifié)'}`,
      status: "success"
    }, request)

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Banque supprimée avec succès"
    })
  } catch (error) {
    console.error('Error deleting bank:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la suppression de la banque"
      },
      { status: 500 }
    )
  }
}
