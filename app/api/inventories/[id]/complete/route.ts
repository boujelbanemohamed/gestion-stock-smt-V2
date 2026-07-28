import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Inventory } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAdmin } from "@/lib/auth-middleware"

// POST /api/inventories/[id]/complete - Clôture l'inventaire (admin uniquement)
// Fige les écarts constatés. Ne touche pas au stock : c'est /adjust qui le fait.

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const inventory = await prisma.inventory.findUnique({
      where: { id: params.id },
      include: { bank: { select: { name: true } }, lines: true },
    })
    if (!inventory) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Inventaire non trouvé" }, { status: 404 })
    }
    if (inventory.status !== "in_progress") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Cet inventaire est déjà clôturé." },
        { status: 409 },
      )
    }

    // Clôturer avec des lignes non comptées produirait un rapport trompeur :
    // on ne saurait pas distinguer « compté à 0 » de « pas encore compté ».
    const nonComptees = inventory.lines.filter((l) => l.countedQuantity === null)
    if (nonComptees.length > 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `${nonComptees.length} ligne(s) n'ont pas encore été comptées. Renseignez-les avant de clôturer.`,
        },
        { status: 400 },
      )
    }

    const ecarts = inventory.lines.filter((l) => l.countedQuantity !== l.expectedQuantity)

    const maj = await prisma.inventory.update({
      where: { id: params.id },
      data: { status: "completed", completedAt: new Date() },
      include: {
        bank: { select: { id: true, name: true, code: true, address: true } },
        startedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

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
          `Clôture de l'inventaire ${inventory.reference} (${inventory.bank.name}) : ` +
          `${inventory.lines.length} lignes comptées, ${ecarts.length} écart(s)`,
        status: "success",
      },
      request,
    )

    return NextResponse.json<ApiResponse<Inventory>>({
      success: true,
      data: maj as unknown as Inventory,
      message: `Inventaire clôturé : ${ecarts.length} écart(s) constaté(s)`,
    })
  } catch (error) {
    console.error("Error completing inventory:", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la clôture de l'inventaire" },
      { status: 500 },
    )
  }
}
