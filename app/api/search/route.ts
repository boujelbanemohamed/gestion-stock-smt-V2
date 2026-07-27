import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import { requireAuth } from "@/lib/auth-middleware"

// GET /api/search?q=... - Recherche globale (banques, cartes, emplacements, utilisateurs)

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const RESULTS_PER_CATEGORY = 5

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  const q = request.nextUrl.searchParams.get("q")?.trim() || ""

  if (q.length < 2) {
    return NextResponse.json<ApiResponse>({
      success: true,
      data: { banks: [], cards: [], locations: [], users: [] },
    })
  }

  try {
    const [banks, cards, locations, users] = await Promise.all([
      prisma.bank.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, code: true },
        take: RESULTS_PER_CATEGORY,
      }),
      prisma.card.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { type: { contains: q, mode: "insensitive" } },
            { subType: { contains: q, mode: "insensitive" } },
            { subSubType: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, type: true, bank: { select: { name: true } } },
        take: RESULTS_PER_CATEGORY,
      }),
      prisma.location.findMany({
        where: {
          isActive: true,
          name: { contains: q, mode: "insensitive" },
        },
        select: { id: true, name: true, bank: { select: { name: true } } },
        take: RESULTS_PER_CATEGORY,
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        take: RESULTS_PER_CATEGORY,
      }),
    ])

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        banks: banks.map((b) => ({ id: b.id, name: b.name, code: b.code })),
        cards: cards.map((c) => ({ id: c.id, name: c.name, type: c.type, bankName: c.bank?.name || "-" })),
        locations: locations.map((l) => ({ id: l.id, name: l.name, bankName: l.bank?.name || "-" })),
        users: users.map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          role: u.role,
        })),
      },
    })
  } catch (error) {
    console.error("Error searching:", error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Erreur lors de la recherche" },
      { status: 500 },
    )
  }
}
