import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import type { ApiResponse } from "@/lib/api-types"
import type { Inventory } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAuth, requireAdmin } from "@/lib/auth-middleware"

// GET    /api/inventories/[id] - Détail complet (toutes les lignes)
// PUT    /api/inventories/[id] - Enregistre les quantités comptées
// DELETE /api/inventories/[id] - Supprime un inventaire (admin uniquement)

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Pas de `as const` ici : Prisma refuse un `orderBy` en lecture seule.
const INCLUDE_DETAIL: Prisma.InventoryInclude = {
  bank: { select: { id: true, name: true, code: true, address: true } },
  startedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  lines: {
    include: {
      card: { select: { id: true, name: true, type: true, subType: true, subSubType: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: [{ locationId: "asc" }, { cardId: "asc" }],
  },
}

function resumer(lines: { expectedQuantity: number; countedQuantity: number | null }[]) {
  const comptees = lines.filter((l) => l.countedQuantity !== null)
  return {
    totalLines: lines.length,
    countedLines: comptees.length,
    discrepancyLines: comptees.filter((l) => l.countedQuantity !== l.expectedQuantity).length,
    totalExpected: lines.reduce((t, l) => t + l.expectedQuantity, 0),
    totalCounted: comptees.reduce((t, l) => t + (l.countedQuantity ?? 0), 0),
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const inventory = await prisma.inventory.findUnique({
      where: { id: params.id },
      include: INCLUDE_DETAIL,
    })
    if (!inventory) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Inventaire non trouvé" }, { status: 404 })
    }

    const detail = inventory as typeof inventory & { lines: { expectedQuantity: number; countedQuantity: number | null }[] }
    return NextResponse.json<ApiResponse<Inventory>>({
      success: true,
      data: { ...detail, ...resumer(detail.lines) } as unknown as Inventory,
    })
  } catch (error) {
    console.error("Error fetching inventory:", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la récupération de l'inventaire" },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()

    const inventory = await prisma.inventory.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, reference: true },
    })
    if (!inventory) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Inventaire non trouvé" }, { status: 404 })
    }

    // Une fois clôturé, les écarts constatés font foi : on ne réécrit plus les
    // quantités comptées, sinon le rapport ne correspondrait plus au comptage.
    if (inventory.status !== "in_progress") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Cet inventaire est clôturé : les quantités ne sont plus modifiables." },
        { status: 409 },
      )
    }

    if (!Array.isArray(body.lines)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "La liste des lignes est requise" },
        { status: 400 },
      )
    }

    // Validation avant toute écriture : une saisie invalide ne doit rien enregistrer.
    for (const ligne of body.lines) {
      if (!ligne || typeof ligne.id !== "string") {
        return NextResponse.json<ApiResponse>(
          { success: false, error: "Ligne d'inventaire invalide" },
          { status: 400 },
        )
      }
      if (ligne.countedQuantity !== null && ligne.countedQuantity !== undefined) {
        const q = Number(ligne.countedQuantity)
        if (!Number.isInteger(q) || q < 0) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: "La quantité comptée doit être un entier positif ou nul" },
            { status: 400 },
          )
        }
      }
    }

    const idsAttendus = new Set(
      (await prisma.inventoryLine.findMany({ where: { inventoryId: params.id }, select: { id: true } })).map(
        (l) => l.id,
      ),
    )
    for (const ligne of body.lines) {
      if (!idsAttendus.has(ligne.id)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: "Une ligne n'appartient pas à cet inventaire" },
          { status: 400 },
        )
      }
    }

    await prisma.$transaction(
      body.lines.map((ligne: any) =>
        prisma.inventoryLine.update({
          where: { id: ligne.id },
          data: {
            countedQuantity:
              ligne.countedQuantity === null || ligne.countedQuantity === undefined
                ? null
                : Number(ligne.countedQuantity),
            notes: typeof ligne.notes === "string" && ligne.notes.trim() ? ligne.notes.trim() : null,
          },
        }),
      ),
    )

    const maj = (await prisma.inventory.findUnique({
      where: { id: params.id },
      include: INCLUDE_DETAIL,
    })) as unknown as { lines: { expectedQuantity: number; countedQuantity: number | null }[] }

    return NextResponse.json<ApiResponse<Inventory>>({
      success: true,
      data: { ...maj, ...resumer(maj.lines) } as unknown as Inventory,
    })
  } catch (error) {
    console.error("Error updating inventory:", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de l'enregistrement du comptage" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const inventory = await prisma.inventory.findUnique({
      where: { id: params.id },
      include: { bank: { select: { name: true } } },
    })
    if (!inventory) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Inventaire non trouvé" }, { status: 404 })
    }

    // Un inventaire régularisé a modifié le stock : le supprimer effacerait la
    // justification de mouvements bien réels. On le conserve comme pièce.
    if (inventory.status === "adjusted") {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Cet inventaire a servi à régulariser le stock : il ne peut plus être supprimé.",
        },
        { status: 409 },
      )
    }

    await prisma.inventory.delete({ where: { id: params.id } })

    await logAudit(
      {
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "delete",
        module: "movements",
        entityType: "inventory",
        entityId: inventory.id,
        entityName: inventory.reference,
        details: `Suppression de l'inventaire ${inventory.reference} (${inventory.bank.name}) par ${auth.user.email}`,
        status: "success",
      },
      request,
    )

    return NextResponse.json<ApiResponse>({ success: true, message: "Inventaire supprimé" })
  } catch (error) {
    console.error("Error deleting inventory:", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la suppression de l'inventaire" },
      { status: 500 },
    )
  }
}
