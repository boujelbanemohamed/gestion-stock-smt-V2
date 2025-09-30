"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { dataStore } from "@/lib/data-store"
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"
import type { Location, Bank, LocationImportRow, LocationFilters } from "@/lib/types"
import { ListSkeleton } from "@/components/ui/loading-skeleton"

export default function LocationsManagement() {
  const [locations, setLocations] = useState<Location[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [cardsByLocation, setCardsByLocation] = useState<Map<string, { card: any; quantity: number }[]>>(new Map())
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importSuccess, setImportSuccess] = useState<number>(0)
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped")
  const [isLoading, setIsLoading] = useState(true)

  const [searchFilters, setSearchFilters] = useState<LocationFilters>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    bankId: "",
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchFilters.bankId) params.append('bankId', searchFilters.bankId)
      if (searchTerm) params.append('search', searchTerm)

      const locationsResponse = await fetch(`/api/locations?${params.toString()}`)
      const locationsData = await locationsResponse.json()
      
      if (locationsData.success) {
        setLocations(locationsData.data || [])
      }

      const banksResponse = await fetch('/api/banks?status=active')
      const banksData = await banksResponse.json()
      if (banksData.success) {
        setBanks(banksData.data || [])
      }

      // Charger les cartes pour chaque location
      setCardsByLocation(new Map())
    } catch (error) {
      console.error('Error loading locations:', error)
    }
    setIsLoading(false)
  }

  const { isRefreshing: isSyncRefreshing } = useDataSync(["locations", "banks", "cards"], loadData)
  const { isRefreshing: isAutoRefreshing } = useAutoRefresh(loadData, 30000)
  const isRefreshing = isSyncRefreshing || isAutoRefreshing

  useEffect(() => {
    loadData()
  }, [searchFilters, searchTerm])

  const getBankName = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId)
    return bank ? bank.name : "N/A"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingLocation) {
        const response = await fetch(`/api/locations/${editingLocation.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, isActive: true })
        })
        const data = await response.json()
        if (!data.success) {
          alert(data.error || 'Erreur lors de la mise à jour')
          return
        }
      } else {
        const response = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, isActive: true })
        })
        const data = await response.json()
        if (!data.success) {
          alert(data.error || 'Erreur lors de la création')
          return
        }
      }

      await loadData()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving location:', error)
      alert('Erreur lors de la sauvegarde')
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      bankId: "",
    })
    setEditingLocation(null)
  }

  const handleEdit = (location: Location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      description: location.description || "",
      bankId: location.bankId,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet emplacement ?")) {
      try {
        const response = await fetch(`/api/locations/${id}`, {
          method: 'DELETE'
        })
        const data = await response.json()
        if (data.success) {
          await loadData()
        } else {
          alert(data.error || 'Erreur lors de la suppression')
        }
      } catch (error) {
        console.error('Error deleting location:', error)
        alert('Erreur lors de la suppression')
      }
    }
  }

  const handleToggleStatus = async (id: string) => {
    const location = locations.find((l) => l.id === id)
    if (!location) return

    const action = location.isActive ? "désactiver" : "activer"
    if (confirm(`Êtes-vous sûr de vouloir ${action} cet emplacement ?`)) {
      try {
        const response = await fetch(`/api/locations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !location.isActive })
        })
        const data = await response.json()
        if (data.success) {
          await loadData()
        }
      } catch (error) {
        console.error('Error toggling location status:', error)
      }
    }
  }

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split("\n").filter((line) => line.trim())

      if (lines.length < 2) {
        setImportErrors(["Le fichier CSV est vide ou invalide"])
        return
      }

      const headers = lines[0].split(";").map((h) => h.trim())
      const expectedHeaders = ["Banque", "NomEmplacement", "Description"]

      if (!expectedHeaders.every((h) => headers.includes(h))) {
        setImportErrors(["En-têtes CSV invalides. Format attendu: Banque;NomEmplacement;Description"])
        return
      }

      const rows: LocationImportRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(";").map((v) => v.trim())
        if (values.length >= 2) {
          rows.push({
            Banque: values[headers.indexOf("Banque")],
            NomEmplacement: values[headers.indexOf("NomEmplacement")],
            Description: values[headers.indexOf("Description")] || "",
          })
        }
      }

      try {
        const response = await fetch('/api/locations/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: rows })
        })
        const data = await response.json()
        
        setImportErrors(data.errors || [])
        setImportSuccess(data.imported || 0)
        
        if (data.imported > 0) {
          await loadData()
        }
      } catch (error) {
        console.error('Error importing locations:', error)
        setImportErrors(['Erreur lors de l\'import'])
      }
    }

    reader.readAsText(file)
  }

  const handleDownloadTemplate = () => {
    const template = "Banque;NomEmplacement;Description\nExemple Banque;Entrepôt Central;Emplacement principal"
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "template_import_emplacement.csv"
    link.click()
  }

  const handleSearch = () => {
    setSearchFilters({ ...searchFilters })
    setIsSearchDialogOpen(false)
  }

  const handleResetFilters = () => {
    setSearchFilters({})
    setSearchTerm("")
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const grouped: { [bankName: string]: Location[] } = {}
    banks.forEach(bank => {
      grouped[bank.name] = locations.filter(l => l.bankId === bank.id)
    })

    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste des Emplacements</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1e293b; }
            h2 { color: #475569; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
            th { background-color: #f1f5f9; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Liste des Emplacements</h1>
          <p>Date: ${new Date().toLocaleDateString()}</p>
    `

    Object.entries(grouped).forEach(([bankName, locationDetails]) => {
      html += `<h2>${bankName}</h2>`
      html += `
        <table>
          <thead>
            <tr>
              <th>Nom de l'emplacement</th>
              <th>Description</th>
              <th>Stock (cartes)</th>
            </tr>
          </thead>
          <tbody>
      `

      locationDetails.forEach((detail) => {
        html += `
          <tr>
            <td>${detail.location.name}</td>
            <td>${detail.location.description || "N/A"}</td>
            <td>${detail.totalCards}</td>
          </tr>
        `
      })

      html += `
          </tbody>
        </table>
      `
    })

    html += `
          <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Imprimer</button>
        </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  const renderGroupedView = () => {
    const grouped: { [bankName: string]: Location[] } = {}
    banks.forEach(bank => {
      grouped[bank.name] = locations.filter(l => l.bankId === bank.id)
    })

    return (
      <Accordion type="single" collapsible className="w-full">
        {Object.entries(grouped).map(([bankName, locationDetails]) => (
          <AccordionItem key={bankName} value={bankName}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="text-left">
                  <div className="font-semibold text-slate-900">{bankName}</div>
                  <div className="text-sm text-slate-500">
                    {locationDetails.length} emplacement{locationDetails.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {locationDetails.reduce((sum, l) => sum + l.totalCards, 0)} cartes total
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-4 pb-2 px-4 space-y-2">
                {locationDetails.map((detail) => {
                  const cards = cardsByLocation.get(detail.location.id) || []
                  return (
                    <div key={detail.location.id} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-slate-900">{detail.location.name}</div>
                          <div className="text-sm text-slate-500">{detail.location.description || "N/A"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {detail.cardTypes} type{detail.cardTypes !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {detail.totalCards} carte{detail.totalCards !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant={detail.location.isActive ? "default" : "secondary"}>
                            {detail.location.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        <Button
                          variant={detail.location.isActive ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleToggleStatus(detail.location.id)}
                        >
                          {detail.location.isActive ? "Désactiver" : "Activer"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(detail.location)}>
                          Modifier
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(detail.location.id)}>
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Emplacements</h2>
          <p className="text-slate-600">Gérez vos lieux de stockage</p>
          {isRefreshing && <p className="text-sm text-blue-600">🔄 Actualisation en cours...</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Template
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Importer
          </Button>
          <Button variant="outline" onClick={() => setIsSearchDialogOpen(true)}>
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Recherche
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Imprimer
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un emplacement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingLocation ? "Modifier l'emplacement" : "Ajouter un emplacement"}</DialogTitle>
                <DialogDescription>
                  {editingLocation
                    ? "Modifiez les informations de l'emplacement."
                    : "Ajoutez un nouveau lieu de stockage."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nom <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bank" className="text-right">
                      Banque <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.bankId}
                      onValueChange={(value) => setFormData({ ...formData, bankId: value })}
                      required
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Sélectionner une banque" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="description" className="text-right mt-2">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="col-span-3"
                      placeholder="Description optionnelle de l'emplacement"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingLocation ? "Modifier" : "Ajouter"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer des emplacements en masse</DialogTitle>
            <DialogDescription>
              Importez plusieurs emplacements à partir d'un fichier CSV. Format: Banque;NomEmplacement;Description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept=".csv" onChange={handleImportCSV} />
            {importSuccess > 0 && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg">
                {importSuccess} emplacement{importSuccess !== 1 ? "s" : ""} importé{importSuccess !== 1 ? "s" : ""} avec
                succès
              </div>
            )}
            {importErrors.length > 0 && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg space-y-1">
                <p className="font-semibold">Erreurs d'importation:</p>
                {importErrors.map((error, index) => (
                  <p key={index} className="text-sm">
                    • {error}
                  </p>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recherche et filtres avancés</DialogTitle>
            <DialogDescription>Recherchez et filtrez les emplacements selon vos critères</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recherche générale</Label>
              <Input
                placeholder="Nom, banque, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label>Banque</Label>
              <Select
                value={searchFilters.bankId || "all"}
                onValueChange={(value) =>
                  setSearchFilters({ ...searchFilters, bankId: value === "all" ? undefined : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les banques" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les banques</SelectItem>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Présence de stock</Label>
              <Select
                value={searchFilters.hasStock === undefined ? "all" : searchFilters.hasStock.toString()}
                onValueChange={(value) =>
                  setSearchFilters({
                    ...searchFilters,
                    hasStock: value === "all" ? undefined : value === "true",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="true">Avec stock</SelectItem>
                  <SelectItem value="false">Sans stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleResetFilters}>
              Réinitialiser
            </Button>
            <Button onClick={handleSearch}>Rechercher</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-slate-200 p-1">
          <Button
            variant={viewMode === "grouped" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grouped")}
          >
            Vue groupée
          </Button>
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
            Vue liste
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des Emplacements</CardTitle>
          <CardDescription>
            {locations.length} emplacement{locations.length !== 1 ? "s" : ""} de stockage
            {Object.keys(searchFilters).length > 0 || searchTerm ? " (filtré)" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton items={3} />
          ) : locations.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <h3 className="mt-2 text-sm font-medium text-slate-900">Aucun emplacement</h3>
              <p className="mt-1 text-sm text-slate-500">
                {Object.keys(searchFilters).length > 0 || searchTerm
                  ? "Aucun emplacement ne correspond à vos critères de recherche."
                  : "Commencez par ajouter votre premier lieu de stockage."}
              </p>
            </div>
          ) : viewMode === "grouped" ? (
            renderGroupedView()
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {locations.map((location) => {
                const cards = cardsByLocation.get(location.id) || []
                const totalCards = cards.reduce((sum, item) => sum + item.quantity, 0)

                return (
                  <AccordionItem key={location.id} value={location.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <div className="font-semibold text-slate-900">{location.name}</div>
                            <div className="text-sm text-slate-500">{getBankName(location.bankId)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {cards.length} type{cards.length !== 1 ? "s" : ""} de carte{cards.length !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {totalCards} carte{totalCards !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant={location.isActive ? "default" : "secondary"}>
                            {location.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-4 pb-2 px-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-slate-500">Description</p>
                            <p className="text-sm text-slate-900">{location.description || "N/A"}</p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant={location.isActive ? "outline" : "default"}
                              size="sm"
                              onClick={() => handleToggleStatus(location.id)}
                            >
                              {location.isActive ? "Désactiver" : "Activer"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(location)}>
                              Modifier
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(location.id)}>
                              Supprimer
                            </Button>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">Cartes en stock</h4>
                          {cards.length === 0 ? (
                            <div className="text-center py-6 bg-slate-50 rounded-lg">
                              <p className="text-sm text-slate-500">Aucune carte dans cet emplacement</p>
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nom de la carte</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Sous-type</TableHead>
                                  <TableHead>Sous-sous-type</TableHead>
                                  <TableHead className="text-right">Quantité</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {cards.map((item) => (
                                  <TableRow key={item.card.id}>
                                    <TableCell className="font-medium">{item.card.name}</TableCell>
                                    <TableCell>{item.card.type}</TableCell>
                                    <TableCell>{item.card.subType}</TableCell>
                                    <TableCell>{item.card.subSubType}</TableCell>
                                    <TableCell className="text-right">
                                      <Badge
                                        variant="outline"
                                        className={
                                          item.quantity < item.card.minThreshold
                                            ? "bg-red-50 text-red-700 border-red-200"
                                            : "bg-green-50 text-green-700 border-green-200"
                                        }
                                      >
                                        {item.quantity}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
