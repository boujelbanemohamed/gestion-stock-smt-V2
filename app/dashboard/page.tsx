"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/dashboard/date-range-picker"
import type { DateRange } from "react-day-picker"
import type { AuditLog } from "@/lib/types"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [stats, setStats] = useState({
    totalBanks: 0,
    totalCardTypes: 0,
    totalLocations: 0,
    movements: 0,
  })
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const logsPerPage = 10

  const loadData = async () => {
    try {
      // Construire les paramètres de date pour les deux APIs
      const params = new URLSearchParams()
      if (dateRange?.from) params.append('dateFrom', dateRange.from.toISOString())
      if (dateRange?.to) params.append('dateTo', dateRange.to.toISOString())

      // Charger les stats avec filtre de date
      const statsUrl = params.toString() ? `/api/stats?${params.toString()}` : '/api/stats'
      const statsResponse = await fetch(statsUrl)
      const statsData = await statsResponse.json()
      
      if (statsData.success) {
        setStats({
          totalBanks: statsData.data.totalBanks,
          totalCardTypes: statsData.data.totalCardTypes,
          totalLocations: statsData.data.totalLocations,
          movements: statsData.data.todayMovements,
        })
      }

      // Charger les logs avec filtre de date et pagination
      const logsParams = new URLSearchParams(params)
      logsParams.append('limit', logsPerPage.toString())
      logsParams.append('offset', ((currentPage - 1) * logsPerPage).toString())
      
      const logsResponse = await fetch(`/api/logs?${logsParams.toString()}`)
      const logsData = await logsResponse.json()
      
      if (logsData.success) {
        setRecentLogs(logsData.data || [])
        setTotalLogs(logsData.total || 0)
        setTotalPages(Math.ceil((logsData.total || 0) / logsPerPage))
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange, currentPage])

  // Réinitialiser la pagination quand la plage de dates change
  useEffect(() => {
    setCurrentPage(1)
  }, [dateRange])

  // Utiliser les hooks pour la synchronisation (avec une fréquence plus raisonnable)
  useDataSync(["banks", "cards", "locations", "movements", "users"], loadData)
  useAutoRefresh(loadData, 60000) // 1 minute au lieu de 30 secondes

  const getActionLabel = (action: string): string => {
    const labels: { [key: string]: string } = {
      create: "Création",
      update: "Modification",
      delete: "Suppression",
      login: "Connexion",
      logout: "Déconnexion",
    }
    return labels[action] || action
  }

  const getModuleLabel = (module: string): string => {
    const labels: { [key: string]: string } = {
      banks: "Banques",
      cards: "Cartes",
      locations: "Emplacements",
      movements: "Mouvements",
      users: "Utilisateurs",
      config: "Configuration",
    }
    return labels[module] || module
  }

  const getStatusVariant = (status: string): "default" | "destructive" | "secondary" => {
    if (status === "success") return "default"
    if (status === "failure") return "destructive"
    return "secondary"
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtrer par période</CardTitle>
          <CardDescription>Sélectionnez une plage de dates pour filtrer les statistiques de mouvements</CardDescription>
        </CardHeader>
        <CardContent>
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} className="max-w-md" />
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Banques</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBanks}</div>
            <p className="text-xs text-muted-foreground">Banques partenaires actives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Types de Cartes</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCardTypes}</div>
            <p className="text-xs text-muted-foreground">Cartes en stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emplacements</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLocations}</div>
            <p className="text-xs text-muted-foreground">Lieux de stockage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mouvements</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.movements}</div>
            <p className="text-xs text-muted-foreground">
              {dateRange?.from || dateRange?.to ? "Mouvements sur la période" : "Mouvements aujourd'hui"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {dateRange?.from || dateRange?.to
              ? "Activité sur la période sélectionnée"
              : "Activité récente (24 dernières heures)"}
          </CardTitle>
          <CardDescription>Historique des actions effectuées sur la plateforme</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune activité récente</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusVariant(log.status)}>{getActionLabel(log.action)}</Badge>
                      <Badge variant="outline">{getModuleLabel(log.module)}</Badge>
                    </div>
                    <p className="text-sm font-medium">{log.entityName || log.details}</p>
                    <p className="text-xs text-muted-foreground">{log.details}</p>
                    <p className="text-xs text-muted-foreground">
                      Par {log.userEmail} • {format(new Date(log.timestamp), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>
                  Page {currentPage} sur {totalPages} ({totalLogs} résultats au total)
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                
                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
