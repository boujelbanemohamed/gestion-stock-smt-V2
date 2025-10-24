"use client"

import { useState, useEffect } from "react"
import type { User } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import BanksManagement from "./banks-management"
import CardsManagement from "./cards-management"
import LocationsManagement from "./locations-management"
import MovementsManagement from "./movements-management"
import UsersManagement from "./users-management"
import ConfigurationPanel from "./configuration-panel"
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"

interface DashboardProps {
  user: User
  onLogout: () => void
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [stats, setStats] = useState({
    totalBanks: 0,
    totalCardTypes: 0,
    totalLocations: 0,
    todayMovements: 0,
    totalCards: 0,
    lowStockCards: 0,
    activeUsers: 0,
    // Nouveaux KPIs
    totalStockVolume: 0,
    avgEntryPerDay: 0,
    avgExitPerDay: 0,
    avgTransferPerDay: 0,
    topBanksWithStock: [],
    bottomBanksWithStock: [],
    banksInMinStock: []
  })

  const loadStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  useDataSync(["banks", "cards", "locations", "movements", "users"], loadStats)
  useAutoRefresh(loadStats, 60000) // 1 minute au lieu de 30 secondes

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default"
      case "manager":
        return "secondary"
      case "operator":
        return "outline"
      default:
        return "outline"
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <svg className="h-5 w-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Gestion de Stocks</h1>
              <p className="text-sm text-slate-600">Plateforme de gestion des cartes bancaires</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">
                {user.firstName} {user.lastName}
              </p>
              <div className="flex items-center space-x-2">
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>
            </div>
            <Button variant="outline" onClick={onLogout}>
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Aperçu</TabsTrigger>
            <TabsTrigger value="banks">Banques</TabsTrigger>
            <TabsTrigger value="cards">Cartes</TabsTrigger>
            <TabsTrigger value="locations">Emplacements</TabsTrigger>
            <TabsTrigger value="movements">Mouvements</TabsTrigger>
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
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
                  <p className="text-xs text-muted-foreground">Différents types de cartes</p>
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
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
                  <div className="text-2xl font-bold">{stats.todayMovements}</div>
                  <p className="text-xs text-muted-foreground">Mouvements aujourd'hui</p>
                </CardContent>
              </Card>
            </div>

            {/* Volume total du stock */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Volume Total du Stock</CardTitle>
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{stats.totalStockVolume.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Cartes en stock total</p>
              </CardContent>
            </Card>

            {/* Moyennes des mouvements par jour */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Moyenne Entrées/Jour</CardTitle>
                  <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.avgEntryPerDay}</div>
                  <p className="text-xs text-muted-foreground">Mouvements d'entrée par jour</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Moyenne Sorties/Jour</CardTitle>
                  <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.avgExitPerDay}</div>
                  <p className="text-xs text-muted-foreground">Mouvements de sortie par jour</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Moyenne Transferts/Jour</CardTitle>
                  <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.avgTransferPerDay}</div>
                  <p className="text-xs text-muted-foreground">Mouvements de transfert par jour</p>
                </CardContent>
              </Card>
            </div>

            {/* Top 3 des banques avec le plus de stock */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span>Top 3 - Banques avec le Plus de Stock</span>
                </CardTitle>
                <CardDescription>Banques ayant le plus de cartes en stock</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topBanksWithStock.map((bank, index) => (
                    <div key={bank.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                          <span className="text-sm font-bold text-green-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{bank.name}</p>
                          <p className="text-sm text-muted-foreground">Stock total</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{bank.totalStock.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">cartes</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top 3 des banques avec le moins de stock */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <svg className="h-5 w-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                  <span>Top 3 - Banques avec le Moins de Stock</span>
                </CardTitle>
                <CardDescription>Banques ayant le moins de cartes en stock</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.bottomBanksWithStock.map((bank, index) => (
                    <div key={bank.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full">
                          <span className="text-sm font-bold text-orange-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{bank.name}</p>
                          <p className="text-sm text-muted-foreground">Stock total</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">{bank.totalStock.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">cartes</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Banques en stock minimum */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Banques en Stock Minimum</span>
                </CardTitle>
                <CardDescription>Banques ayant des cartes sous le seuil minimum</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.banksInMinStock.length > 0 ? (
                  <div className="space-y-4">
                    {stats.banksInMinStock.map((bank) => (
                      <div key={bank.id} className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-red-800">{bank.name}</h4>
                          <Badge variant="destructive">Stock Minimum</Badge>
                        </div>
                        <div className="space-y-2">
                          {bank.lowStockCards.map((card, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="text-red-700">{card.name}</span>
                              <div className="flex items-center space-x-2">
                                <span className="text-red-600 font-medium">{card.quantity}</span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-muted-foreground">{card.minThreshold}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="h-12 w-12 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-green-600 font-medium">Aucune banque en stock minimum</p>
                    <p className="text-sm text-muted-foreground">Tous les stocks sont au-dessus du seuil minimum</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bienvenue dans la plateforme de gestion de stocks</CardTitle>
                <CardDescription>
                  Gérez efficacement vos stocks de cartes bancaires, suivez les mouvements et administrez vos
                  emplacements.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2"></div>
                    <div>
                      <p className="font-medium">Gestion des Banques</p>
                      <p className="text-sm text-muted-foreground">Ajoutez et gérez vos banques partenaires</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2"></div>
                    <div>
                      <p className="font-medium">Inventaire des Cartes</p>
                      <p className="text-sm text-muted-foreground">
                        Suivez vos stocks de cartes par type et emplacement
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2"></div>
                    <div>
                      <p className="font-medium">Traçabilité Complète</p>
                      <p className="text-sm text-muted-foreground">Historique détaillé de tous les mouvements</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banks">
            <BanksManagement />
          </TabsContent>

          <TabsContent value="cards">
            <CardsManagement />
          </TabsContent>

          <TabsContent value="locations">
            <LocationsManagement />
          </TabsContent>

          <TabsContent value="movements">
            <MovementsManagement />
          </TabsContent>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

          <TabsContent value="config">
            <ConfigurationPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
