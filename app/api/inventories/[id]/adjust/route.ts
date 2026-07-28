import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Inventory } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAdmin } from "@/lib/auth-middleware"
import { serverEvents } from "@/lib/server-events"

// POST /api/inventories/[id]/adjust - Régularise le stock d'après le comptage
// (admin uniquement). Aligne stock_levels sur les quantités comptées et trace
// chaque correction par un mouvement, pour que l'historique reste vérifiable.

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const inventory = await prisma.inventory.findUnique({
      where: { id: params.id },
      include: {
        bank: { select: { name: true } },
        lines: { include: { card: { select: { name: true } }, location: { select: { name: true } } } },
      },
    })
    if (!inventory) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Inventaire non trouvé" }, { status: 404 })
    }
    if (inventory.status === "adjusted") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Cet inventaire a déjà été régularisé." },
        { status: 409 },
      )
    }
    if (inventory.status !== "completed") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Clôturez l'inventaire avant de régulariser le stock." },
        { status: 409 },
      )
    }

    const ecarts = inventory.lines.filter(
      (l) => l.countedQuantity !== null && l.countedQuantity !== l.expectedQuantity,
    )

    if (ecarts.length === 0) {
      const sansEcart = await prisma.inventory.update({
        where: { id: params.id },
        data: { status: "adjusted", adjustedAt: new Date() },
      })
      return NextResponse.json<ApiResponse<Inventory>>({
        success: true,
        data: sansEcart as unknown as Inventory,
        message: "Aucun écart : le stock était déjà conforme au comptage.",
      })
    }

    // Tout en une transaction : un échec au milieu laisserait le stock à moitié
    // régularisé, sans moyen de savoir où la reprise doit repartir.
    const cartesTouchees = new Set<string>()
    await prisma.$transaction(async (tx) => {
      for (const ligne of ecarts) {
        const compte = ligne.countedQuantity as number

        const existant = await tx.stockLevel.findFirst({
          where: { cardId: ligne.cardId, locationId: ligne.locationId },
        })

        // Le mouvement tracé doit décrire la variation RÉELLE du stock, pas
        // l'écart d'inventaire (compté - théorique figé). Les deux diffèrent dès
        // qu'un mouvement a eu lieu pendant le comptage ; utiliser l'écart
        // d'inventaire laisserait un historique qui n'explique plus le stock.
        const stockActuel = existant?.quantity ?? 0
        const variation = compte - stockActuel

        if (existant) {
          await tx.stockLevel.update({ where: { id: existant.id }, data: { quantity: compte } })
        } else {
          await tx.stockLevel.create({
            data: { cardId: ligne.cardId, locationId: ligne.locationId, quantity: compte },
          })
        }

        // Un excédent est une entrée à l'emplacement, un manquant une sortie.
        // On réutilise les types existants plutôt que d'en inventer un : toutes
        // les vues (historique, statistiques, exports) les affichent déjà.
        if (variation !== 0) {
          await tx.movement.create({
            data: {
              cardId: ligne.cardId,
              movementType: variation > 0 ? "entry" : "exit",
              fromLocationId: variation > 0 ? null : ligne.locationId,
              toLocationId: variation > 0 ? ligne.locationId : null,
              quantity: Math.abs(variation),
              reason: `Régularisation inventaire ${inventory.reference}`,
              userId: auth.user.id,
            },
          })
        }

        cartesTouchees.add(ligne.cardId)
      }

      // Resynchronise le compteur dénormalisé card.quantity, comme le font la
      // création et la suppression de mouvement.
      for (const cardId of cartesTouchees) {
        const agg = await tx.stockLevel.aggregate({ where: { cardId }, _sum: { quantity: true } })
        await tx.card.update({ where: { id: cardId }, data: { quantity: agg._sum.quantity ?? 0 } })
      }

      await tx.inventory.update({
        where: { id: params.id },
        data: { status: "adjusted", adjustedAt: new Date() },
      })
    })

    const detail = ecarts
      .map((l) => {
        const d = (l.countedQuantity as number) - l.expectedQuantity
        return `${l.card.name} @ ${l.location.name} : ${d > 0 ? "+" : ""}${d}`
      })
      .join(" ; ")

    await logAudit(
      {
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "update",
        module: "movements",
        entityType: "inventory",
        entityId: inventory.id,
        entityName: inventory.reference,
        details:
          `Régularisation du stock d'après l'inventaire ${inventory.reference} (${inventory.bank.name}) : ` +
          `${ecarts.length} écart(s) corrigé(s) — ${detail}`,
        status: "success",
      },
      request,
    )

    try {
      // Même signature que la création/suppression de mouvement : les écrans
      // ouverts rechargent leur liste de mouvements et leur stock.
      serverEvents.emit("movement", { action: "created" })
    } catch {
      // La diffusion temps réel est un confort : son échec ne doit pas annuler
      // une régularisation déjà enregistrée.
    }

    const maj = await prisma.inventory.findUnique({
      where: { id: params.id },
      include: {
        bank: { select: { id: true, name: true, code: true, address: true } },
        startedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return NextResponse.json<ApiResponse<Inventory>>({
      success: true,
      data: maj as unknown as Inventory,
      message: `Stock régularisé : ${ecarts.length} correction(s) appliquée(s)`,
    })
  } catch (error) {
    console.error("Error adjusting inventory:", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la régularisation du stock" },
      { status: 500 },
    )
  }
}
