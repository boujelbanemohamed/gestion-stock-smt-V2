import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Inventory } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAuth, requireAdmin } from "@/lib/auth-middleware"

// GET  /api/inventories - Liste des inventaires (avec avancement)
// POST /api/inventories - Ouvre un inventaire sur une banque (admin uniquement)

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Compteurs d'avancement, identiques pour la liste et le détail. */
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

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const bankId = searchParams.get("bankId")
    const status = searchParams.get("status")

    const inventories = await prisma.inventory.findMany({
      where: {
        ...(bankId && bankId !== "all" ? { bankId } : {}),
        ...(status && status !== "all" ? { status } : {}),
      },
      include: {
        bank: { select: { id: true, name: true, code: true, address: true } },
        startedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        lines: { select: { expectedQuantity: true, countedQuantity: true } },
      },
      orderBy: { startedAt: "desc" },
    })

    // On ne renvoie pas les lignes ici : seulement leur synthèse, pour garder
    // la liste légère même avec des inventaires de plusieurs centaines de lignes.
    const data = inventories.map(({ lines, ...inv }) => ({ ...inv, ...resumer(lines) }))

    return NextResponse.json<ApiResponse<Inventory[]>>({ success: true, data: data as Inventory[] })
  } catch (error) {
    console.error("Error fetching inventories:", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la récupération des inventaires" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()

    if (!body.bankId || typeof body.bankId !== "string") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "La banque est requise" },
        { status: 400 },
      )
    }

    const bank = await prisma.bank.findUnique({ where: { id: body.bankId } })
    if (!bank) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Banque non trouvée" }, { status: 404 })
    }

    // Un seul inventaire ouvert par banque : deux comptages simultanés sur le
    // même périmètre produiraient des régularisations contradictoires.
    const ouvert = await prisma.inventory.findFirst({
      where: { bankId: body.bankId, status: "in_progress" },
    })
    if (ouvert) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Un inventaire est déjà en cours sur cette banque (${ouvert.reference}). Clôturez-le avant d'en ouvrir un autre.`,
        },
        { status: 409 },
      )
    }

    // Périmètre : toutes les cartes de la banque, à chacun de ses emplacements.
    // On part des stock_levels pour ne lister que les couples réellement suivis,
    // et on y ajoute les cartes de la banque encore absentes de tout emplacement
    // seulement si un emplacement existe (sinon il n'y a rien à compter).
    const locations = await prisma.location.findMany({
      where: { bankId: body.bankId },
      select: { id: true },
    })
    if (locations.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Cette banque n'a aucun emplacement : rien à inventorier." },
        { status: 400 },
      )
    }

    const niveaux = await prisma.stockLevel.findMany({
      where: {
        locationId: { in: locations.map((l) => l.id) },
        card: { bankId: body.bankId },
      },
      select: { cardId: true, locationId: true, quantity: true },
    })

    if (niveaux.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Aucun stock enregistré pour cette banque : rien à inventorier." },
        { status: 400 },
      )
    }

    const horodatage = new Date()
    const reference = `INV-${horodatage.getFullYear()}${String(horodatage.getMonth() + 1).padStart(2, "0")}${String(
      horodatage.getDate(),
    ).padStart(2, "0")}-${bank.code}-${String(horodatage.getHours()).padStart(2, "0")}${String(
      horodatage.getMinutes(),
    ).padStart(2, "0")}`

    const inventory = await prisma.inventory.create({
      data: {
        reference,
        bankId: body.bankId,
        startedById: auth.user.id,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        // expectedQuantity est figé ici : c'est le stock théorique au moment du
        // lancement, il ne doit plus bouger même si des mouvements ont lieu après.
        lines: {
          create: niveaux.map((n) => ({
            cardId: n.cardId,
            locationId: n.locationId,
            expectedQuantity: n.quantity,
          })),
        },
      },
      include: {
        bank: { select: { id: true, name: true, code: true, address: true } },
        startedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        lines: { select: { expectedQuantity: true, countedQuantity: true } },
      },
    })

    await logAudit(
      {
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "create",
        module: "movements",
        entityType: "inventory",
        entityId: inventory.id,
        entityName: inventory.reference,
        details: `Ouverture de l'inventaire ${inventory.reference} sur ${bank.name} (${niveaux.length} lignes à compter)`,
        status: "success",
      },
      request,
    )

    const { lines, ...reste } = inventory
    return NextResponse.json<ApiResponse<Inventory>>(
      { success: true, data: { ...reste, ...resumer(lines) } as Inventory },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error creating inventory:", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de l'ouverture de l'inventaire" },
      { status: 500 },
    )
  }
}
