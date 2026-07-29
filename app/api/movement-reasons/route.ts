import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { MovementReason } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAuth, requireAdmin } from "@/lib/auth-middleware"
import { lireMotifParType } from "@/lib/movement-reason-config"
import { resoudreMotifParType, typeDuMotif } from "@/lib/movement-reason-types"

// GET /api/movement-reasons - Récupérer la liste des motifs de mouvement
// POST /api/movement-reasons - Créer un nouveau motif (admin uniquement)

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_REASONS = [
  "Fabrication",
  "Expedition",
  "Expedition Sortie",
  "Transfert",
  "Entrée en stock",
]

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    let reasons = await prisma.movementReason.findMany({
      orderBy: { createdAt: 'asc' },
    })

    // Première utilisation : créer les motifs par défaut (dont "Autre", protégé et non supprimable).
    if (reasons.length === 0) {
      await prisma.movementReason.createMany({
        data: [
          ...DEFAULT_REASONS.map((label) => ({ label })),
          { label: "Autre", isOther: true },
        ],
      })
      reasons = await prisma.movementReason.findMany({
        orderBy: { createdAt: 'asc' },
      })
    }

    // Le type de mouvement de chaque motif vient de la configuration, pas d'une
    // colonne : on le rattache ici pour que l'écran de configuration et le
    // formulaire de mouvement n'aient qu'une seule requête à faire.
    const correspondance = resoudreMotifParType(await lireMotifParType(), reasons)

    return NextResponse.json<ApiResponse<MovementReason[]>>({
      success: true,
      data: reasons.map((motif) => ({
        ...motif,
        movementType: typeDuMotif(correspondance, motif.id),
      })) as MovementReason[],
    })
  } catch (error) {
    console.error('Error fetching movement reasons:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des motifs",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()

    if (!body.label || typeof body.label !== "string" || !body.label.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Le libellé du motif est requis" },
        { status: 400 },
      )
    }

    // "Autre" est un motif système unique : on ne peut pas en créer un second via l'API publique.
    const newReason = await prisma.movementReason.create({
      data: { label: body.label.trim(), isOther: false },
    })

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: "create",
      module: "config",
      entityType: "movement_reason",
      entityId: newReason.id,
      entityName: newReason.label,
      details: `Création du motif "${newReason.label}" par ${auth.user.email}`,
      status: "success",
    }, request)

    return NextResponse.json<ApiResponse<MovementReason>>(
      { success: true, data: newReason as MovementReason, message: "Motif créé avec succès" },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating movement reason:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la création du motif" },
      { status: 500 },
    )
  }
}
