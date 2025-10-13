import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { AuditLog } from "@/lib/types"
import { logAudit, type LogEntry } from "@/lib/audit-logger"

// GET /api/logs - Récupérer les logs d'audit avec filtres optionnels

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
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
    if (status === "success") where.status = "success"
    if (status === "failure") where.status = "failure"

    if (searchTerm) {
      where.OR = [
        { userEmail: { contains: searchTerm, mode: 'insensitive' } },
        { action: { contains: searchTerm, mode: 'insensitive' } },
        { details: { contains: searchTerm, mode: 'insensitive' } },
        { entityName: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      where.timestamp = {}
      if (dateFrom) where.timestamp.gte = new Date(dateFrom)
      if (dateTo) where.timestamp.lte = new Date(dateTo)
    } else {
      // Par défaut, afficher les logs des 30 derniers jours
      // Pour afficher tous les logs, ne pas envoyer de paramètres dateFrom/dateTo
      const last30Days = new Date()
      last30Days.setDate(last30Days.getDate() - 30)
      where.timestamp = {
        gte: last30Days
      }
    }

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
  try {
    const body = await request.json()
    
    const logEntry: LogEntry = {
      userId: body.userId,
      userEmail: body.userEmail,
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