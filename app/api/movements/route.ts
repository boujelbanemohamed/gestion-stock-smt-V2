import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Movement } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { verifyAuth, requireAuth } from "@/lib/auth-middleware"
import { serverEvents } from "@/lib/server-events"
import { createLowStockNotification, createMovementNotification } from "@/lib/notification-helper"

// GET /api/movements - Récupérer tous les mouvements

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const searchParams = request.nextUrl.searchParams
    const cardId = searchParams.get("cardId")
    const fromLocationId = searchParams.get("fromLocationId")
    const toLocationId = searchParams.get("toLocationId")
    const movementType = searchParams.get("type")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const bankId = searchParams.get("bankId")
    const searchTerm = searchParams.get("searchTerm")
    
    // Paramètres de pagination
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "30", 10)
    const offset = (page - 1) * limit

    const where: any = {}
    let combinedConditions: any[] = []

    if (cardId && cardId !== "all") combinedConditions.push({ cardId })
    if (movementType && movementType !== "all") combinedConditions.push({ movementType })
    
    // Filtre par emplacement source (De)
    if (fromLocationId && fromLocationId !== "all") {
      combinedConditions.push({ fromLocationId })
    }
    
    // Filtre par emplacement destination (Vers)
    if (toLocationId && toLocationId !== "all") {
      combinedConditions.push({ toLocationId })
    }

    if (dateFrom || dateTo) {
      let createdAtFilter: any = {}
      if (dateFrom) createdAtFilter.gte = new Date(dateFrom)
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999) // Inclure toute la journée
        createdAtFilter.lte = toDate
      }
      combinedConditions.push({ createdAt: createdAtFilter })
    }

    // Filtre par banque (via la carte)
    if (bankId && bankId !== "all") {
      combinedConditions.push({
        card: {
          bankId: bankId
        }
      })
    }

    // Filtre par terme de recherche (motif, nom de carte, nom d'utilisateur)
    if (searchTerm) {
      combinedConditions.push({
        OR: [
          { reason: { contains: searchTerm, mode: 'insensitive' } },
          { card: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { user: {
            OR: [
              { firstName: { contains: searchTerm, mode: 'insensitive' } },
              { lastName: { contains: searchTerm, mode: 'insensitive' } }
            ]
          } }
        ]
      })
    }
    
    // Combiner toutes les conditions avec AND
    if (combinedConditions.length > 0) {
      where.AND = combinedConditions
    }

    // Compter le total avec les filtres
    const total = await prisma.movement.count({ where })

    // Récupérer les mouvements paginés
    const movements = await prisma.movement.findMany({
      where,
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
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    return NextResponse.json<ApiResponse<{ movements: Movement[]; total: number; page: number; limit: number; totalPages: number }>>({
      success: true,
      data: {
        movements: movements as Movement[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
    })
  } catch (error) {
    console.error('Error fetching movements:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des mouvements",
      },
      { status: 500 },
    )
  }
}

// POST /api/movements - Créer un nouveau mouvement
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification JWT
    let userData
    try {
      userData = verifyAuth(request)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Token invalide"
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Authentification requise. ${errorMessage}`,
        },
        { status: 401 },
      )
    }

    const body = await request.json()
    const userId = userData.id

    // Log pour déboguer
    console.log('POST /api/movements - userId from JWT:', userId)
    console.log('POST /api/movements - user email:', userData.email)

          // Validation des champs requis
          if (!body.cardId || !body.movementType || !body.quantity) {
            return NextResponse.json<ApiResponse>(
              {
                success: false,
                error: "Champs requis manquants: cardId, movementType, quantity",
              },
              { status: 400 },
            )
          }

          // Validation de la quantité : entier strictement positif.
          // Le contrôle ci-dessus ne teste qu'une valeur "falsy" : il rejette 0
          // mais laisse passer les quantités négatives, qui inversaient alors le
          // sens du mouvement et corrompaient le stock. On normalise également en
          // nombre pour que les calculs de stock en aval soient sans ambiguïté.
          const quantity = Number(body.quantity)
          if (!Number.isInteger(quantity) || quantity <= 0) {
            return NextResponse.json<ApiResponse>(
              {
                success: false,
                error: "La quantité doit être un entier strictement positif",
              },
              { status: 400 },
            )
          }
          body.quantity = quantity

          // Validation du motif (obligatoire)
          if (!body.reason || body.reason.trim() === "") {
            return NextResponse.json<ApiResponse>(
              {
                success: false,
                error: "Le motif est obligatoire",
              },
              { status: 400 },
            )
          }

    // Vérifier que l'utilisateur existe dans la base de données
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      console.error(`User not found in database: ${userId}`)
      console.error(`Available users in database:`, await prisma.user.findMany({ select: { id: true, email: true } }))
      
      // Si l'utilisateur n'existe pas, suggérer de vérifier l'email depuis le JWT
      const userEmail = userData.email || 'non spécifié'
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Utilisateur introuvable. L'ID ${userId} (${userEmail}) n'existe pas dans la base de données. Veuillez vous déconnecter et vous reconnecter.`,
        },
        { status: 404 },
      )
    }

    // Vérifier que l'utilisateur est actif
    if (!user.isActive) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Votre compte utilisateur est désactivé",
        },
        { status: 403 },
      )
    }

    // Validation du type de mouvement
    if (!['entry', 'exit', 'transfer'].includes(body.movementType)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Type de mouvement invalide (entry, exit, ou transfer)",
        },
        { status: 400 },
      )
    }

    // Règles de présence des emplacements selon le type
    if (body.movementType === 'entry' && !body.toLocationId) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Emplacement destination requis pour une entrée" }, { status: 400 })
    }
    if (body.movementType === 'exit' && !body.fromLocationId) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Emplacement source requis pour une sortie" }, { status: 400 })
    }
    if (body.movementType === 'transfer' && (!body.fromLocationId || !body.toLocationId)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Source et destination sont requis pour un transfert" }, { status: 400 })
    }

    // Récupérer la carte
    const card = await prisma.card.findUnique({ where: { id: body.cardId } })
    if (!card) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Carte introuvable" }, { status: 404 })
    }

    // Vérifier cohérence banque: la carte appartient à une seule banque
    if (body.bankId && card.bankId !== body.bankId) {
      return NextResponse.json<ApiResponse>({ success: false, error: "La carte n'appartient pas à cette banque" }, { status: 400 })
    }

    // Helpers stock par emplacement via StockLevel
    const getStockLevel = async (cardId: string, locationId: string) => {
      const level = await prisma.stockLevel.findFirst({ where: { cardId, locationId } })
      return level?.quantity ?? 0
    }

    // Stock total réel = somme des stock_levels (source de vérité).
    // On ne fait jamais confiance à card.quantity pour la validation car ce
    // champ est un compteur dupliqué qui peut diverger (import, correction
    // manuelle en base, etc.). On l'utilise seulement pour l'affichage/stats
    // et on le recalcule après chaque mouvement pour qu'il reste toujours
    // synchronisé (auto-correction).
    const getTotalStock = async (cardId: string, tx: any = prisma) => {
      const agg = await tx.stockLevel.aggregate({
        where: { cardId },
        _sum: { quantity: true },
      })
      return agg._sum.quantity ?? 0
    }

    const adjustStockLevel = async (
      tx: any,
      cardId: string,
      locationId: string,
      delta: number
    ) => {
      const existing = await tx.stockLevel.findFirst({ where: { cardId, locationId } })
      if (!existing) {
        // Si delta est négatif et pas de stock, refuser
        if (delta < 0) throw new Error("Stock insuffisant à l'emplacement")
        await tx.stockLevel.create({ data: { cardId, locationId, quantity: delta } })
      } else {
        const newQty = existing.quantity + delta
        if (newQty < 0) throw new Error("Stock insuffisant à l'emplacement")
        await tx.stockLevel.update({ where: { id: existing.id }, data: { quantity: newQty } })
      }
    }

    const newMovement = await prisma.$transaction(async (tx) => {
      // Ajustements selon le type
      if (body.movementType === 'entry') {
        // + stock destination, puis on resynchronise card.quantity sur le vrai total
        await adjustStockLevel(tx, card.id, body.toLocationId, +body.quantity)
        const total = await getTotalStock(card.id, tx)
        await tx.card.update({ where: { id: card.id }, data: { quantity: total } })
      } else if (body.movementType === 'exit') {
        // Vérifier stock à l'emplacement source (seule contrainte métier réelle:
        // on ne peut pas sortir plus que ce qui est physiquement à cet emplacement)
        const locQty = await getStockLevel(card.id, body.fromLocationId)
        if (locQty < body.quantity) {
          throw new Error("Quantité insuffisante à l'emplacement source")
        }
        // Vérification du total réel (calculé depuis stock_levels, pas depuis
        // le champ card.quantity qui peut être désynchronisé)
        const totalStock = await getTotalStock(card.id, tx)
        if (totalStock < body.quantity) {
          throw new Error("Quantité totale de carte insuffisante")
        }
        // - stock source, puis resynchronisation de card.quantity
        await adjustStockLevel(tx, card.id, body.fromLocationId, -body.quantity)
        const total = await getTotalStock(card.id, tx)
        await tx.card.update({ where: { id: card.id }, data: { quantity: total } })
      } else if (body.movementType === 'transfer') {
        // Vérifier stock source
        const locQty = await getStockLevel(card.id, body.fromLocationId)
        if (locQty < body.quantity) {
          throw new Error("Quantité insuffisante à l'emplacement source pour le transfert")
        }
        // 0 carte au total, - source, + destination
        await adjustStockLevel(tx, card.id, body.fromLocationId, -body.quantity)
        await adjustStockLevel(tx, card.id, body.toLocationId, +body.quantity)
        // Resynchronisation de card.quantity par sécurité (devrait rester inchangé)
        const total = await getTotalStock(card.id, tx)
        await tx.card.update({ where: { id: card.id }, data: { quantity: total } })
      }

      // Créer le mouvement
      const created = await tx.movement.create({
        data: {
          cardId: body.cardId,
          fromLocationId: body.fromLocationId || null,
          toLocationId: body.toLocationId || null,
          movementType: body.movementType,
          quantity: body.quantity,
          reason: body.reason || "",
          userId: userId,
          // Document justificatif : uniquement pertinent pour les entrées
          documentUrl: body.movementType === 'entry' ? (body.documentUrl || null) : null,
          documentName: body.movementType === 'entry' ? (body.documentName || null) : null,
        },
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

      return created
    })

    // Logger la création du mouvement
    const movementTypeLabels: Record<string, string> = { entry: "Entrée", exit: "Sortie", transfer: "Transfert" }
    const movementTypeLabel = movementTypeLabels[body.movementType] || body.movementType
    await logAudit({
      userId: userData?.id || userId,
      userEmail: newMovement.user.email,
      action: "create",
      module: "movements",
      entityType: "movement",
      entityId: newMovement.id,
      entityName: `${movementTypeLabel} - ${newMovement.card.name}`,
      details: `Mouvement de type ${movementTypeLabel}: ${newMovement.quantity} x ${newMovement.card.name}. Raison: ${newMovement.reason}`,
      status: "success"
    }, request)

    // Pousse le mouvement en temps réel (SSE) aux clients connectés : les pages
    // Mouvements et Tableau de bord se rafraîchissent instantanément, sans polling.
    serverEvents.emit("movement", { action: "created", movementId: newMovement.id })

    // Envoyer notification email pour le mouvement
    try {
      const { sendMovementNotification } = await import("@/lib/email-service")
      await sendMovementNotification(
        body.movementType,
        newMovement.card.name,
        body.quantity,
        newMovement.fromLocation?.name,
        newMovement.toLocation?.name,
        body.reason || ""
      )
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de la notification email:', emailError)
      // On continue même si l'email échoue
    }

    // Créer la notification in-app correspondante
    try {
      await createMovementNotification(body.movementType, newMovement.card.name, body.quantity)
    } catch (notifError) {
      console.error('Erreur lors de la création de la notification in-app:', notifError)
      // On continue même si la notification échoue
    }

    // Vérifier les seuils de stock après le mouvement
    try {
      const { sendLowStockAlert } = await import("@/lib/email-service")
      
      // Récupérer la carte avec ses stocks par emplacement
      const cardWithStock = await prisma.card.findUnique({
        where: { id: body.cardId },
        include: {
          bank: true,
          stockLevels: {
            include: {
              location: true
            }
          }
        }
      })

      if (cardWithStock) {
        // Vérifier chaque emplacement
        for (const stockLevel of cardWithStock.stockLevels || []) {
          if (stockLevel.quantity < cardWithStock.minThreshold) {
            await sendLowStockAlert(
              cardWithStock.name,
              stockLevel.quantity,
              cardWithStock.minThreshold,
              stockLevel.location?.name,
              cardWithStock.bank?.name
            )
            await createLowStockNotification(
              `${cardWithStock.name} (${stockLevel.location?.name || "emplacement inconnu"})`,
              stockLevel.quantity,
              cardWithStock.minThreshold
            )
          }
        }
      }
    } catch (alertError) {
      console.error('Erreur lors de la vérification des alertes de stock:', alertError)
      // On continue même si l'alerte échoue
    }

    return NextResponse.json<ApiResponse<Movement>>(
      {
        success: true,
        data: newMovement as Movement,
        message: "Mouvement créé avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating movement:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création du mouvement",
      },
      { status: 500 },
    )
  }
}