"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { dataStore } from "@/lib/data-store"
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"
import type { Card as CardData, Bank, CardFilters, CardImportRow, CardDetails } from "@/lib/types"
import { ChevronDown, ChevronRight, Download, Upload, Search, Filter, Printer } from "lucide-react"
import { ListSkeleton } from "@/components/ui/loading-skeleton"

export default function CardsManagement() {
  const [cards, setCards] = useState<CardData[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CardData | null>(null)
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<CardFilters>({
    searchTerm: "",
  })
  const [cardTypes, setCardTypes] = useState<string[]>([])
  const [cardSubTypes, setCardSubTypes] = useState<string[]>([])
  const [cardSubSubTypes, setCardSubSubTypes] = useState<string[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResults, setImportResults] = useState<{ success: CardData[]; errors: string[] } | null>(null)
  const [groupedCards, setGroupedCards] = useState<{ [bankName: string]: CardDetails[] }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Charger les cartes
      const params = new URLSearchParams()
      if (filters.bankId) params.append('bankId', filters.bankId)
      if (filters.type) params.append('type', filters.type)
      if (filters.subType) params.append('subType', filters.subType)
      if (filters.subSubType) params.append('subSubType', filters.subSubType)
      if (filters.lowStock) params.append('lowStock', 'true')
      if (filters.searchTerm) params.append('search', filters.searchTerm)

      const cardsResponse = await fetch(`/api/cards?${params.toString()}`)
      const cardsData = await cardsResponse.json()
      if (cardsData.success) {
        setCards(cardsData.data || [])
        // Extraire les types uniques
        const types = Array.from(new Set(cardsData.data.map((c: any) => c.type)))
        const subTypes = Array.from(new Set(cardsData.data.map((c: any) => c.subType)))
        const subSubTypes = Array.from(new Set(cardsData.data.map((c: any) => c.subSubType)))
        setCardTypes(types as string[])
        setCardSubTypes(subTypes as string[])
        setCardSubSubTypes(subSubTypes as string[])
      }

      // Charger les banques actives
      const banksResponse = await fetch('/api/banks?status=active')
      const banksData = await banksResponse.json()
      if (banksData.success) {
        setBanks(banksData.data || [])
      }

      // Grouper les cartes par banque avec la structure CardDetails
      if (cardsData.success && banksData.success) {
        const grouped: any = {}
        banksData.data.forEach((bank: any) => {
          const bankCards = cardsData.data
            .filter((c: any) => c.bankId === bank.id)
            .map((c: any) => ({
              card: c,
              remainingQuantity: c.quantity // La quantité restante est la quantité de la carte
            }))
          grouped[bank.name] = bankCards
        })
        setGroupedCards(grouped)
      }
    } catch (error) {
      console.error('Error loading cards:', error)
    }
    setIsLoading(false)
  }

  const { isRefreshing: isSyncRefreshing } = useDataSync(["cards", "banks"], loadData)
  const { isRefreshing: isAutoRefreshing } = useAutoRefresh(loadData, 30000)
  const isRefreshing = isSyncRefreshing || isAutoRefreshing

  useEffect(() => {
    loadData()
  }, [filters])

  const getBankName = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId)
    return bank ? bank.name : "N/A"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: {
      minThreshold?: string
      maxThreshold?: string
    } = {}

    if (formData.minThreshold >= formData.maxThreshold) {
      errors.minThreshold = "Le seuil minimum doit être inférieur au seuil maximum"
      errors.maxThreshold = "Le seuil maximum doit être supérieur au seuil minimum"
    }

    if (formData.minThreshold < 0) {
      errors.minThreshold = "Le seuil minimum doit être positif"
    }

    if (formData.maxThreshold < 0) {
      errors.maxThreshold = "Le seuil maximum doit être positif"
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})

    try {
      if (editingCard) {
        const response = await fetch(`/api/cards/${editingCard.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            quantity: editingCard.quantity,
            isActive: true,
          })
        })
        const data = await response.json()
        if (!data.success) {
          alert(data.error || 'Erreur lors de la mise à jour')
          return
        }
      } else {
        const response = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            quantity: 0,
            isActive: true,
          })
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
      console.error('Error saving card:', error)
      alert('Erreur lors de la sauvegarde')
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      subType: "",
      subSubType: "",
      bankId: "",
      minThreshold: 50,
      maxThreshold: 1000,
    })
    setEditingCard(null)
    setFormErrors({})
  }

  const handleEdit = (card: CardData) => {
    setEditingCard(card)
    setFormData({
      name: card.name,
      type: card.type,
      subType: card.subType,
      subSubType: card.subSubType,
      bankId: card.bankId,
      minThreshold: card.minThreshold,
      maxThreshold: card.maxThreshold,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette carte ?")) {
      try {
        const response = await fetch(`/api/cards/${id}`, {
          method: 'DELETE'
        })
        const data = await response.json()
        if (data.success) {
          await loadData()
        } else {
          alert(data.error || 'Erreur lors de la suppression')
        }
      } catch (error) {
        console.error('Error deleting card:', error)
        alert('Erreur lors de la suppression')
      }
    }
  }

  const downloadTemplate = () => {
    const csvContent =
      "BanqueEmettrice;NomCarte;Type;SousType;SousSousType\nBanque Internationale;Carte Débit Jeune;Carte débit;Mastercard;National\nBanque Internationale;Carte Débit Gold;Carte débit;Mastercard;International\nBanque Centrale;Carte Débit Standard;Carte débit;Visa;National"

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "template_import_cartes.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setImportFile(file)
    }
  }

  const processImport = async () => {
    if (!importFile) return

    const text = await importFile.text()
    const lines = text.split("\n").filter((line) => line.trim())
    const headers = lines[0].split(";")

    const cards: CardImportRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(";")
      const card: any = {}

      headers.forEach((header, index) => {
        card[header.trim()] = values[index]?.trim() || ""
      })

      cards.push(card as CardImportRow)
    }

    try {
      const response = await fetch('/api/cards/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: cards })
      })
      const data = await response.json()
      
      setImportResults({
        success: data.imported > 0 ? cards.slice(0, data.imported) : [],
        errors: data.errors || []
      })

      if (data.imported > 0) {
        await loadData()
      }
    } catch (error) {
      console.error('Error importing cards:', error)
      setImportResults({
        success: [],
        errors: ['Erreur lors de l\'import']
      })
    }
  }

  const resetFilters = () => {
    setFilters({
      searchTerm: "",
    })
  }

  const handlePrint = () => {
    const printContent = Object.entries(groupedCards)
      .map(([bankName, bankCards]) => {
        let content = `${bankName}\n`
        content += bankCards
          .map((cardDetail) => {
            const card = cardDetail.card
            return `  - ${card.name} (${card.type} – ${card.subType} – ${card.subSubType}) → ${card.quantity} restantes`
          })
          .join("\n")
        return content
      })
      .join("\n\n")

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Liste des Cartes</title></head>
          <body style="font-family: Arial, sans-serif; white-space: pre-line;">
            <h1>Liste des Cartes par Banque</h1>
            <p>Généré le ${new Date().toLocaleDateString("fr-FR")}</p>
            <hr>
            ${printContent}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const toggleBankExpansion = (bankName: string) => {
    const newExpanded = new Set(expandedBanks)
    if (newExpanded.has(bankName)) {
      newExpanded.delete(bankName)
    } else {
      newExpanded.add(bankName)
    }
    setExpandedBanks(newExpanded)
  }

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    subType: "",
    subSubType: "",
    bankId: "",
    minThreshold: 50,
    maxThreshold: 1000,
  })

  const [formErrors, setFormErrors] = useState<{
    minThreshold?: string
    maxThreshold?: string
  }>({})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Cartes</h2>
          <p className="text-slate-600">
            Gérez votre inventaire de cartes avec hiérarchie Type → Sous-type → Sous-sous-type
          </p>
          {isRefreshing && <p className="text-sm text-blue-600">Actualisation en cours...</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template CSV
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importer
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter une carte
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingCard ? "Modifier la carte" : "Ajouter une carte"}</DialogTitle>
                <DialogDescription>
                  {editingCard
                    ? "Modifiez les informations de la carte."
                    : "Ajoutez un nouveau type de carte (stock géré par mouvements)."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bank" className="text-right">
                      Banque émettrice
                    </Label>
                    <Select
                      value={formData.bankId}
                      onValueChange={(value) => setFormData({ ...formData, bankId: value })}
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
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nom
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
                    <Label htmlFor="type" className="text-right">
                      Type
                    </Label>
                    <Input
                      id="type"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="col-span-3"
                      placeholder="ex. Carte débit"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="subType" className="text-right">
                      Sous-type
                    </Label>
                    <Input
                      id="subType"
                      value={formData.subType}
                      onChange={(e) => setFormData({ ...formData, subType: e.target.value })}
                      className="col-span-3"
                      placeholder="ex. Mastercard"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="subSubType" className="text-right">
                      Sous-sous-type
                    </Label>
                    <Input
                      id="subSubType"
                      value={formData.subSubType}
                      onChange={(e) => setFormData({ ...formData, subSubType: e.target.value })}
                      className="col-span-3"
                      placeholder="ex. National"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="minThreshold" className="text-right">
                      Seuil min
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="minThreshold"
                        type="number"
                        value={formData.minThreshold}
                        onChange={(e) => {
                          setFormData({ ...formData, minThreshold: Number.parseInt(e.target.value) || 0 })
                          if (formErrors.minThreshold) {
                            setFormErrors({ ...formErrors, minThreshold: undefined })
                          }
                        }}
                        className={formErrors.minThreshold ? "border-red-500" : ""}
                        min="0"
                        required
                      />
                      {formErrors.minThreshold && (
                        <p className="text-sm text-red-500 mt-1">{formErrors.minThreshold}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="maxThreshold" className="text-right">
                      Seuil max
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="maxThreshold"
                        type="number"
                        value={formData.maxThreshold}
                        onChange={(e) => {
                          setFormData({ ...formData, maxThreshold: Number.parseInt(e.target.value) || 0 })
                          if (formErrors.maxThreshold) {
                            setFormErrors({ ...formErrors, maxThreshold: undefined })
                          }
                        }}
                        className={formErrors.maxThreshold ? "border-red-500" : ""}
                        min="0"
                        required
                      />
                      {formErrors.maxThreshold && (
                        <p className="text-sm text-red-500 mt-1">{formErrors.maxThreshold}</p>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingCard ? "Modifier" : "Ajouter"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recherche et Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="search">Recherche</Label>
              <Input
                id="search"
                placeholder="Nom, type, sous-type..."
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bankFilter">Banque</Label>
              <Select
                value={filters.bankId || "all"}
                onValueChange={(value) => setFilters({ ...filters, bankId: value === "all" ? undefined : value })}
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
              <Label htmlFor="typeFilter">Type</Label>
              <Select
                value={filters.type || "all"}
                onValueChange={(value) => setFilters({ ...filters, type: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {cardTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="subTypeFilter">Sous-type</Label>
              <Select
                value={filters.subType || "all"}
                onValueChange={(value) => setFilters({ ...filters, subType: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les sous-types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les sous-types</SelectItem>
                  {cardSubTypes.map((subType) => (
                    <SelectItem key={subType} value={subType}>
                      {subType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lowStock">Stock faible</Label>
              <Select
                value={filters.lowStock ? "true" : "false"}
                onValueChange={(value) => setFilters({ ...filters, lowStock: value === "true" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Tous</SelectItem>
                  <SelectItem value="true">Stock &lt; 50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards List - Grouped by Bank */}
      <Card>
        <CardHeader>
          <CardTitle>Cartes par Banque</CardTitle>
          <CardDescription>
            {Object.values(groupedCards).reduce((total, cards) => total + cards.length, 0)} carte(s) au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton items={3} />
          ) : Object.keys(groupedCards).length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900">Aucune carte trouvée</h3>
              <p className="mt-1 text-sm text-slate-500">
                Ajustez vos critères de recherche ou ajoutez une nouvelle carte.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedCards).map(([bankName, bankCards]) => (
                <Card key={bankName} className="border-l-4 border-l-green-500">
                  <Collapsible>
                    <CollapsibleTrigger className="w-full" onClick={() => toggleBankExpansion(bankName)}>
                      <CardHeader className="hover:bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {expandedBanks.has(bankName) ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <div className="text-left">
                              <CardTitle className="text-lg">{bankName}</CardTitle>
                              <CardDescription>{bankCards.length} type(s) de carte(s)</CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {bankCards.map((cardDetail) => {
                            const card = cardDetail.card
                            return (
                              <div
                                key={card.id}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded border"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{card.name}</div>
                                  <div className="text-sm text-slate-600">
                                    {card.type} – {card.subType} – {card.subSubType}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant={card.quantity <= card.minThreshold ? "destructive" : "default"}>
                                    {card.quantity} restantes
                                  </Badge>
                                  <div className="flex space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(card)}>
                                      Modifier
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDelete(card.id)}>
                                      Supprimer
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Importer des cartes</DialogTitle>
            <DialogDescription>
              Importez un fichier CSV contenant la liste des cartes à ajouter (sans stock initial).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Fichier CSV</Label>
              <Input id="file" type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} />
              <p className="text-sm text-slate-500 mt-1">
                Format attendu: BanqueEmettrice;NomCarte;Type;SousType;SousSousType
              </p>
            </div>
            {importFile && (
              <div className="p-3 bg-blue-50 rounded">
                <p className="text-sm">
                  <strong>Fichier sélectionné:</strong> {importFile.name}
                </p>
                <p className="text-sm text-slate-600">Taille: {(importFile.size / 1024).toFixed(2)} KB</p>
              </div>
            )}
            {importResults && (
              <div className="space-y-2">
                {importResults.success.length > 0 && (
                  <div className="p-3 bg-green-50 rounded">
                    <p className="text-sm font-medium text-green-800">
                      ✅ {importResults.success.length} carte(s) importée(s) avec succès
                    </p>
                  </div>
                )}
                {importResults.errors.length > 0 && (
                  <div className="p-3 bg-red-50 rounded">
                    <p className="text-sm font-medium text-red-800 mb-2">❌ Erreurs détectées:</p>
                    <ul className="text-sm text-red-700 space-y-1">
                      {importResults.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false)
                setImportFile(null)
                setImportResults(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
              }}
            >
              Fermer
            </Button>
            <Button onClick={processImport} disabled={!importFile}>
              <Upload className="h-4 w-4 mr-2" />
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
