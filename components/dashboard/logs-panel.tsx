"use client"

import { useState, useEffect } from "react"
import type { AuditLog, User } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function LogsPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [moduleFilter, setModuleFilter] = useState<string>("all")
  const [userFilter, setUserFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  useEffect(() => {
    loadCurrentUser()
    loadUsers()
    loadLogs()
  }, [])

  const loadCurrentUser = async () => {
    try {
      // Pour l'instant, simuler un utilisateur admin
      const usersResponse = await fetch('/api/users')
      const usersData = await usersResponse.json()
      if (usersData.success && usersData.data.length > 0) {
        const admin = usersData.data.find((u: any) => u.role === 'admin')
        setCurrentUser(admin || usersData.data[0])
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    }
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      if (data.success) {
        setUsers(data.data || [])
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  useEffect(() => {
    filterLogs()
  }, [logs, searchTerm, actionFilter, moduleFilter, userFilter, startDate, endDate])

  const loadLogs = async () => {
    try {
      const response = await fetch('/api/logs')
      const data = await response.json()
      if (data.success) {
        setLogs(data.data || [])
      }
    } catch (error) {
      console.error('Error loading logs:', error)
    }
  }

  const filterLogs = () => {
    let filtered = [...logs]

    // Filtre par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          (log.userName || log.userEmail).toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Filtre par action
    if (actionFilter !== "all") {
      filtered = filtered.filter((log) => log.action === actionFilter)
    }

    // Filtre par module
    if (moduleFilter !== "all") {
      filtered = filtered.filter((log) => log.module === moduleFilter)
    }

    // Filtre par utilisateur
    if (userFilter !== "all") {
      filtered = filtered.filter((log) => log.userId === userFilter)
    }

    // Filtre par plage de dates
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      filtered = filtered.filter((log) => new Date(log.timestamp) >= start)
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter((log) => new Date(log.timestamp) <= end)
    }

    setFilteredLogs(filtered)
  }

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "create":
        return "default"
      case "update":
        return "secondary"
      case "delete":
        return "destructive"
      case "login":
        return "outline"
      default:
        return "outline"
    }
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case "create":
        return "Création"
      case "update":
        return "Modification"
      case "delete":
        return "Suppression"
      case "login":
        return "Connexion"
      case "login_failed":
        return "Échec connexion"
      default:
        return action
    }
  }

  const getModuleLabel = (module: string) => {
    switch (module) {
      case "users":
        return "Utilisateurs"
      case "roles":
        return "Rôles"
      case "banks":
        return "Banques"
      case "cards":
        return "Cartes"
      case "locations":
        return "Emplacements"
      case "movements":
        return "Mouvements"
      case "auth":
        return "Authentification"
      case "config":
        return "Configuration"
      default:
        return module
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(date))
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Logs d'audit</h1>
        <p className="text-slate-600 mt-2">Consultez l'historique complet des actions effectuées sur la plateforme</p>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Filtrez les logs par terme de recherche, action, module, utilisateur ou période</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Recherche</label>
                <Input
                  placeholder="Rechercher par utilisateur, action, détails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Action</label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les actions</SelectItem>
                    <SelectItem value="create">Création</SelectItem>
                    <SelectItem value="update">Modification</SelectItem>
                    <SelectItem value="delete">Suppression</SelectItem>
                    <SelectItem value="login">Connexion</SelectItem>
                    <SelectItem value="login_failed">Échec connexion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Module</label>
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les modules</SelectItem>
                    <SelectItem value="users">Utilisateurs</SelectItem>
                    <SelectItem value="roles">Rôles</SelectItem>
                    <SelectItem value="banks">Banques</SelectItem>
                    <SelectItem value="cards">Cartes</SelectItem>
                    <SelectItem value="locations">Emplacements</SelectItem>
                    <SelectItem value="movements">Mouvements</SelectItem>
                    <SelectItem value="auth">Authentification</SelectItem>
                    <SelectItem value="config">Configuration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Utilisateur</label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les utilisateurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les utilisateurs</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Date de début</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || undefined}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Date de fin</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-slate-600">
              {filteredLogs.length} log{filteredLogs.length > 1 ? "s" : ""} trouvé{filteredLogs.length > 1 ? "s" : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("")
                setActionFilter("all")
                setModuleFilter("all")
                setUserFilter("all")
                setStartDate("")
                setEndDate("")
              }}
            >
              Réinitialiser les filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des logs */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des actions</CardTitle>
          <CardDescription>Liste chronologique de toutes les actions effectuées</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900">Aucun log trouvé</h3>
              <p className="mt-1 text-sm text-slate-500">Aucun log ne correspond aux critères de recherche.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getActionBadgeVariant(log.action)}>{getActionLabel(log.action)}</Badge>
                        <Badge variant="outline">{getModuleLabel(log.module)}</Badge>
                        <span className="text-sm text-slate-600">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-1">{log.details}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-600">
                        <span>
                          <span className="font-medium">Utilisateur:</span> {log.userName || log.userEmail}
                        </span>
                        {log.ipAddress && (
                          <span>
                            <span className="font-medium">IP:</span> {log.ipAddress}
                          </span>
                        )}
                        {log.userAgent && (
                          <span className="truncate max-w-md">
                            <span className="font-medium">Navigateur:</span> {log.userAgent}
                          </span>
                        )}
                      </div>
                    </div>
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
