import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { AuditLog } from "@/lib/types"
import { logAudit, type LogEntry } from "@/lib/audit-logger"
import { requireAuth, requireAdmin } from "@/lib/auth-middleware"

// GET /api/logs - Récupérer les logs d'audit avec filtres optionnels

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const module = searchParams.get("module")
    const action = searchParams.get("action")
    const status = searchParams.get("status")
    const searchTerm = searchParams.get("search")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    const where: any = {}

    if (userId) where.userId = userId
    if (module && module !== "all") where.module = module
    if (action && action !== "all") where.action = action
    if (status && status !== "all") {
      if (status === "success") where.status = "success"
      if (status === "failure") where.status = "failure"
    }

    // Filtre par terme de recherche
    // Note: Si d'autres filtres sont présents, on combine avec AND
    if (searchTerm) {
      const searchConditions = {
        OR: [
          { userEmail: { contains: searchTerm, mode: 'insensitive' } },
          { action: { contains: searchTerm, mode: 'insensitive' } },
          { details: { contains: searchTerm, mode: 'insensitive' } },
          { entityName: { contains: searchTerm, mode: 'insensitive' } },
        ]
      }
      
      // Si on a déjà des conditions, on doit les combiner avec AND
      if (Object.keys(where).length > 0) {
        const existingConditions = { ...where }
        where.AND = [
          existingConditions,
          searchConditions
        ]
        // Supprimer les propriétés qui ont été déplacées dans AND
        Object.keys(existingConditions).forEach(key => delete where[key])
      } else {
        Object.assign(where, searchConditions)
      }
    }

    if (dateFrom || dateTo) {
      where.timestamp = {}
      if (dateFrom) where.timestamp.gte = new Date(dateFrom)
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999) // Inclure toute la journée
        where.timestamp.lte = toDate
      }
    }
    // Note: Si aucune date n'est fournie, on affiche tous les logs (pas de limite par défaut)

    // Récupérer les paramètres de pagination
    const limitParam = searchParams.get("limit")
    const offsetParam = searchParams.get("offset")
    const limit = limitParam ? parseInt(limitParam) : 10
    const offset = offsetParam ? parseInt(offsetParam) : 0

    // Compter le total des logs pour la pagination
    const total = await prisma.auditLog.count({ where })

    // Récupérer les logs avec pagination
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      skip: offset,
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: logs as AuditLog[],
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Error fetching logs:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des logs",
      },
      { status: 500 },
    )
  }
}

// POST /api/logs - Créer un log d'audit manuellement
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()

    // userId/userEmail viennent toujours du token vérifié, jamais du corps de
    // la requête : sinon n'importe quel utilisateur authentifié pourrait
    // fabriquer de fausses entrées d'audit attribuées à quelqu'un d'autre.
    const logEntry: LogEntry = {
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: body.action,
      module: body.module,
      entityType: body.entityType,
      entityId: body.entityId,
      entityName: body.entityName,
      details: body.details,
      status: body.status || "success",
      errorMessage: body.errorMessage,
    }

    await logAudit(logEntry, request)

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Log créé avec succès",
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating log:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création du log",
      },
      { status: 500 },
    )
  }
}