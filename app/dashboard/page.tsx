"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DateRangePicker } from "@/components/dashboard/date-range-picker"
import type { DateRange } from "react-day-picker"
import type { AuditLog } from "@/lib/types"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [stats, setStats] = useState({
    totalBanks: 0,
    totalCardTypes: 0,
    totalLocations: 0,
    movements: 0,
  })
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        // Charger les stats
        const statsResponse = await fetch('/api/stats')
        const statsData = await statsResponse.json()
        
        if (statsData.success) {
          setStats({
            totalBanks: statsData.data.totalBanks,
            totalCardTypes: statsData.data.totalCardTypes,
            totalLocations: statsData.data.totalLocations,
            movements: statsData.data.todayMovements,
          })
        }

        // Charger les logs
        const logsParams = new URLSearchParams()
        if (dateRange?.from) logsParams.append('dateFrom', dateRange.from.toISOString())
        if (dateRange?.to) logsParams.append('dateTo', dateRange.to.toISOString())
        logsParams.append('limit', '10')

        const logsResponse = await fetch(`/api/logs?${logsParams.toString()}`)
        const logsData = await logsResponse.json()
        
        if (logsData.success) {
          setRecentLogs(logsData.data || [])
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      }
    }

    loadData()

    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [dateRange])

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
        </CardContent>
      </Card>
    </div>
  )
}
