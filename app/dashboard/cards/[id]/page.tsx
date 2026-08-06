"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import type { Card as CardType, Movement } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { authenticatedFetch } from "@/lib/api-client"
import { ArrowLeft, Plus } from "lucide-react"

const MOVEMENTS_PER_PAGE = 20

function getMovementTypeLabel(type: string) {
  switch (type) {
    case "entry":
      return "Entrée"
    case "exit":
      return "Sortie"
    case "transfer":
      return "Transfert"
    default:
      return type
  }
}

function getMovementTypeBadge(type: string) {
  switch (type) {
    case "entry":
      return "default"
    case "exit":
      return "destructive"
    case "transfer":
      return "secondary"
    default:
      return "outline"
  }
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function CardDetailPage() {
  const params = useParams<{ id: string }>()
  const cardId = params.id

  const [card, setCard] = useState<CardType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [movements, setMovements] = useState<Movement[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalMovements, setTotalMovements] = useState(0)

  useEffect(() => {
    const loadCard = async () => {
      try {
        const response = await authenticatedFetch(`/api/cards/${cardId}`)
        const data = await response.json()
        if (data.success) {
          setCard(data.data)
        }
      } catch (error) {
        console.error("Error loading card:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadCard()
  }, [cardId])

  useEffect(() => {
    const loadMovements = async () => {
      try {
        const searchParams = new URLSearchParams()
        searchParams.append("cardId", cardId)
        searchParams.append("page", currentPage.toString())
        searchParams.append("limit", MOVEMENTS_PER_PAGE.toString())
        const response = await authenticatedFetch(`/api/movements?${searchParams.toString()}`)
        const data = await response.json()
        if (data.success && data.data) {
          setMovements(data.data.movements || [])
          setTotalMovements(data.data.total || 0)
          setTotalPages(data.data.totalPages || 1)
        }
      } catch (error) {
        console.error("Error loading movements:", error)
      }
    }
    loadMovements()
  }, [cardId, currentPage])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/cards" className="inline-flex items-center gap-1 text-sm text-[#008DA8] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Retour aux cartes
        </Link>
        <p className="text-slate-600">Carte non trouvée.</p>
      </div>
    )
  }

  const stockLevels = card.stockLevels || []
  const totalStock = stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
  const isLowStock = card.isActive && totalStock <= card.minThreshold

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/cards"
            className="mb-2 inline-flex items-center gap-1 text-sm text-[#008DA8] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux cartes
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">{card.name}</h2>
            <Badge variant={card.isActive ? "default" : "secondary"} className={card.isActive ? "bg-green-600" : ""}>
              {card.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-xs text-[#008DA8]">
            {card.type} → {card.subType} → {card.subSubType}
          </p>
        </div>
        {card.isActive && (
          <Link href={`/dashboard/movements?cardId=${card.id}`}>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau mouvement
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Banque</CardDescription>
            <CardTitle className="text-lg">{card.bank?.name || "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stock total</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              {totalStock}
              <Badge variant={isLowStock ? "destructive" : "default"}>
                {isLowStock ? "Stock bas" : "OK"}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Seuils (min - max)</CardDescription>
            <CardTitle className="text-lg">
              {card.minThreshold} - {card.maxThreshold}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock par emplacement</CardTitle>
        </CardHeader>
        <CardContent>
          {stockLevels.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun stock enregistré pour cette carte.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emplacement</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockLevels.map((sl) => (
                  <TableRow key={sl.id}>
                    <TableCell>{sl.location?.name || sl.locationId}</TableCell>
                    <TableCell className="text-right">{sl.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des mouvements</CardTitle>
          <CardDescription>
            {totalMovements} mouvement{totalMovements !== 1 ? "s" : ""} pour cette carte
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun mouvement enregistré pour cette carte.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date et Heure</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead>Vers</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Motif</TableHead>
                      <TableHead>Utilisateur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(movement.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getMovementTypeBadge(movement.movementType) as any}>
                            {getMovementTypeLabel(movement.movementType)}
                          </Badge>
                        </TableCell>
                        <TableCell>{(movement as any).fromLocation?.name || "-"}</TableCell>
                        <TableCell>{(movement as any).toLocation?.name || "-"}</TableCell>
                        <TableCell>{movement.quantity}</TableCell>
                        <TableCell className="max-w-xs truncate">{movement.reason}</TableCell>
                        <TableCell className="text-sm">
                          {(movement as any).user
                            ? `${(movement as any).user.firstName} ${(movement as any).user.lastName}`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} sur {totalPages}
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
