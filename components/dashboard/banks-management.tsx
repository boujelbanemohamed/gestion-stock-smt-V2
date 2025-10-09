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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"
import { ListSkeleton } from "@/components/ui/loading-skeleton"
import type { Bank, BankFilters, BankImportRow } from "@/lib/types"
import { ChevronDown, ChevronRight, Download, Upload, Search, Filter, Printer } from "lucide-react"

export default function BanksManagement() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<BankFilters>({
    status: "all",
    searchTerm: "",
  })
  const [countries, setCountries] = useState<string[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResults, setImportResults] = useState<{ success: Bank[]; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(true)


  const [formData, setFormData] = useState({
    name: "",
    code: "",
    country: "",
    swiftCode: "",
    address: "",
    phone: "",
    email: "",
  })

  const [formErrors, setFormErrors] = useState<{
    name?: string
    code?: string
    country?: string
    address?: string
    phone?: string
    email?: string
    swiftCode?: string
  }>({})

  const loadBanks = async () => {
    setIsLoading(true)
    try {
      // Construire l'URL avec les filtres
      const params = new URLSearchParams()
      if (filters.country) params.append('country', filters.country)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.searchTerm) params.append('search', filters.searchTerm)
      
      const response = await fetch(`/api/banks?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        setBanks(data.data || [])
        
        // Extraire les pays uniques
        const uniqueCountries = Array.from(new Set(data.data.map((b: Bank) => b.country)))
        setCountries(uniqueCountries as string[])
      }

      // Charger aussi les locations et cartes pour l'affichage des détails
      const locationsResponse = await fetch('/api/locations')
      const locationsData = await locationsResponse.json()
      if (locationsData.success) {
        setLocations(locationsData.data || [])
      }

      const cardsResponse = await fetch('/api/cards')
      const cardsData = await cardsResponse.json()
      if (cardsData.success) {
        setCards(cardsData.data || [])
      }
    } catch (error) {
      console.error('Error loading banks:', error)
    }
    setIsLoading(false)
  }

  const { isRefreshing: isSyncRefreshing } = useDataSync(["banks"], loadBanks)
  const { isRefreshing: isAutoRefreshing, lastRefresh } = useAutoRefresh(loadBanks, 120000) // 2 minutes

  const isRefreshing = isSyncRefreshing || isAutoRefreshing

  useEffect(() => {
    loadBanks()
  }, [filters])


  // Gestion de la soumission du formulaire (async pour les appels API)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: {
      name?: string
      code?: string
      country?: string
      address?: string
      phone?: string
      email?: string
      swiftCode?: string
    } = {}

    if (!formData.name || formData.name.trim() === "") {
      errors.name = "Le nom de la banque est obligatoire"
    }

    if (!formData.code || formData.code.trim() === "") {
      errors.code = "Le code de la banque est obligatoire"
    }

    if (!formData.country || formData.country.trim() === "") {
      errors.country = "Le pays est obligatoire"
    }

    if (!formData.address || formData.address.trim() === "") {
      errors.address = "L'adresse est obligatoire"
    }

    if (!formData.phone || formData.phone.trim() === "") {
      errors.phone = "Le téléphone est obligatoire"
    }

    if (formData.phone && formData.phone.trim() !== "") {
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
      if (!phoneRegex.test(formData.phone)) {
        errors.phone = "Le format du numéro de téléphone est invalide"
      }
    }

    if (formData.email && formData.email.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        errors.email = "Le format de l'email est invalide"
      }
    }

    if (formData.swiftCode && formData.swiftCode.trim() !== "") {
      const swiftRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/
      if (!swiftRegex.test(formData.swiftCode.toUpperCase())) {
        errors.swiftCode = "Le code Swift doit contenir 8 ou 11 caractères (format: AAAABBCCXXX)"
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})

    try {
      if (editingBank) {
        const response = await fetch(`/api/banks/${editingBank.id}`, {
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
        const response = await fetch('/api/banks', {
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

      await loadBanks()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving bank:', error)
      alert('Erreur lors de la sauvegarde')
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      country: "",
      swiftCode: "",
      address: "",
      phone: "",
      email: "",
    })
    setEditingBank(null)
    setFormErrors({})
  }

  const handleEdit = (bank: Bank) => {
    setEditingBank(bank)
    setFormData({
      name: bank.name,
      code: bank.code,
      country: bank.country,
      swiftCode: bank.swiftCode,
      address: bank.address,
      phone: bank.phone,
      email: bank.email,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette banque ?")) {
      try {
        const response = await fetch(`/api/banks/${id}`, {
          method: 'DELETE'
        })
        const data = await response.json()
        if (data.success) {
          await loadBanks()
        } else {
          alert(data.error || 'Erreur lors de la suppression')
        }
      } catch (error) {
        console.error('Error deleting bank:', error)
        alert('Erreur lors de la suppression')
      }
    }
  }

  const handleToggleStatus = async (bank: Bank) => {
    const action = bank.isActive ? "désactiver" : "activer"
    const message = bank.isActive
      ? "Êtes-vous sûr de vouloir désactiver cette banque ? Vous ne pourrez plus ajouter de cartes, d'emplacements ou effectuer de mouvements affiliés à cette banque."
      : "Êtes-vous sûr de vouloir activer cette banque ?"

    if (confirm(message)) {
      try {
        const response = await fetch(`/api/banks/${bank.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !bank.isActive })
        })
        const data = await response.json()
        if (data.success) {
          await loadBanks()
        }
      } catch (error) {
        console.error('Error toggling bank status:', error)
      }
    }
  }

  const toggleBankExpansion = (bankId: string) => {
    const newExpanded = new Set(expandedBanks)
    if (newExpanded.has(bankId)) {
      newExpanded.delete(bankId)
    } else {
      newExpanded.add(bankId)
    }
    setExpandedBanks(newExpanded)
  }

  const downloadTemplate = () => {
    const csvContent =
      "ID;CodeBanque;NomBanque;Pays;SwiftCode;Adresse;Telephone;Email\n;B001;Banque Centrale;Tunisie;BCTNTNTT;123 Avenue Habib Bourguiba;+216 71 123 456;contact@bc.tn\n;B002;Banque Internationale;France;BIFRFRPP;45 Rue de la Paix;+33 1 42 86 87 88;info@bi.fr"

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "template_import_banques.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExport = () => {
    // Créer le header
    const headers = "ID;CodeBanque;NomBanque;Pays;SwiftCode;Adresse;Telephone;Email"
    
    // Créer les lignes de données
    const rows = banks.map(bank => 
      `${bank.id};${bank.code};${bank.name};${bank.country};${bank.swiftCode};${bank.address || ''};${bank.phone || ''};${bank.email || ''}`
    )
    
    // Combiner header et rows
    const csvContent = [headers, ...rows].join('\n')

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `export_banques_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setImportFile(file)
    }
  }

  const processImport = async () => {
    if (!importFile) return

    try {
      const text = await importFile.text()
      const lines = text.split("\n").filter((line) => line.trim())
      const headers = lines[0].split(";")

      const banks: BankImportRow[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(";")
        const bank: any = {}

        headers.forEach((header, index) => {
          bank[header.trim()] = values[index]?.trim() || ""
        })

        banks.push(bank as BankImportRow)
      }

      // Appeler l'API d'import
      const response = await fetch('/api/banks/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: banks })
      })

      const apiResponse = await response.json()
      
      // Adapter la réponse de l'API au format attendu par le composant
      const results = {
        success: [], // Les banques importées sont ajoutées à la base de données
        errors: apiResponse.errors || []
      }
      
      setImportResults(results)

      if (results.success.length > 0) {
        await loadBanks()
      }
    } catch (error) {
      console.error('Error importing banks:', error)
      setImportResults({
        success: [],
        errors: ['Erreur lors de l\'import du fichier']
      })
    }
  }

  const resetFilters = () => {
    setFilters({
      status: "all",
      searchTerm: "",
    })
  }

  const handlePrint = () => {
    const printContent = banks
      .map((bank) => {
        let content = `${bank.name} (${bank.code})\nPays: ${bank.country}\nSwift: ${bank.swiftCode}\nStatut: ${bank.isActive ? "Active" : "Inactive"}\n`

        const bankLocations = locations.filter((l) => l.bankId === bank.id)
        if (bankLocations.length > 0) {
          content += `Emplacements: ${bankLocations.map((l) => l.name).join(", ")}\n`
        } else {
          content += `Emplacements: N/A\n`
        }

        const bankCards = cards.filter((c) => c.bankId === bank.id)
        if (bankCards.length > 0) {
          content += `Cartes:\n${bankCards.map((c) => `  • ${c.name} → ${c.quantity} restantes`).join("\n")}\n`
        } else {
          content += `Cartes: N/A\n`
        }

        return content
      })
      .join("\n---\n")

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Liste des Banques</title></head>
          <body style="font-family: Arial, sans-serif; white-space: pre-line;">
            <h1>Liste des Banques</h1>
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

  const displayValue = (value: string | undefined | null): string => {
    return value && value.trim() !== "" ? value : "N/A"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Banques</h2>
          <p className="text-slate-600">Gérez vos banques partenaires</p>
          {isRefreshing && <p className="text-sm text-blue-600">Actualisation en cours...</p>}
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template CSV
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter
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
                Ajouter une banque
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingBank ? "Modifier la banque" : "Ajouter une banque"}</DialogTitle>
                <DialogDescription>
                  {editingBank ? "Modifiez les informations de la banque." : "Ajoutez une nouvelle banque partenaire."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nom <span className="text-red-500">*</span>
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value })
                          if (formErrors.name) {
                            setFormErrors({ ...formErrors, name: undefined })
                          }
                        }}
                        className={formErrors.name ? "border-red-500" : ""}
                        required
                      />
                      {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="code" className="text-right">
                      Code <span className="text-red-500">*</span>
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => {
                          setFormData({ ...formData, code: e.target.value })
                          if (formErrors.code) {
                            setFormErrors({ ...formErrors, code: undefined })
                          }
                        }}
                        className={formErrors.code ? "border-red-500" : ""}
                        required
                      />
                      {formErrors.code && <p className="text-sm text-red-500 mt-1">{formErrors.code}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="country" className="text-right">
                      Pays <span className="text-red-500">*</span>
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => {
                          setFormData({ ...formData, country: e.target.value })
                          if (formErrors.country) {
                            setFormErrors({ ...formErrors, country: undefined })
                          }
                        }}
                        className={formErrors.country ? "border-red-500" : ""}
                        required
                      />
                      {formErrors.country && <p className="text-sm text-red-500 mt-1">{formErrors.country}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="swiftCode" className="text-right">
                      Code Swift
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="swiftCode"
                        value={formData.swiftCode}
                        onChange={(e) => {
                          setFormData({ ...formData, swiftCode: e.target.value })
                          if (formErrors.swiftCode) {
                            setFormErrors({ ...formErrors, swiftCode: undefined })
                          }
                        }}
                        className={formErrors.swiftCode ? "border-red-500" : ""}
                        placeholder="Ex: BCTNTNTT"
                      />
                      {formErrors.swiftCode && <p className="text-sm text-red-500 mt-1">{formErrors.swiftCode}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="address" className="text-right">
                      Adresse <span className="text-red-500">*</span>
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => {
                          setFormData({ ...formData, address: e.target.value })
                          if (formErrors.address) {
                            setFormErrors({ ...formErrors, address: undefined })
                          }
                        }}
                        className={formErrors.address ? "border-red-500" : ""}
                        required
                      />
                      {formErrors.address && <p className="text-sm text-red-500 mt-1">{formErrors.address}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">
                      Téléphone <span className="text-red-500">*</span>
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData({ ...formData, phone: e.target.value })
                          if (formErrors.phone) {
                            setFormErrors({ ...formErrors, phone: undefined })
                          }
                        }}
                        className={formErrors.phone ? "border-red-500" : ""}
                        placeholder="Ex: +216 71 123 456"
                        required
                      />
                      {formErrors.phone && <p className="text-sm text-red-500 mt-1">{formErrors.phone}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value })
                          if (formErrors.email) {
                            setFormErrors({ ...formErrors, email: undefined })
                          }
                        }}
                        className={formErrors.email ? "border-red-500" : ""}
                        placeholder="Ex: contact@banque.tn"
                      />
                      {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingBank ? "Modifier" : "Ajouter"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recherche et Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Recherche</Label>
              <Input
                id="search"
                placeholder="Nom, code ou pays..."
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="country">Pays</Label>
              <Select
                value={filters.country || "all"}
                onValueChange={(value) => setFilters({ ...filters, country: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les pays</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Statut</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actives</SelectItem>
                  <SelectItem value="inactive">Inactives</SelectItem>
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

      <Card>
        <CardHeader>
          <CardTitle>Liste des Banques</CardTitle>
          <CardDescription>
            {banks.length} banque{banks.length !== 1 ? "s" : ""} trouvée{banks.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton items={3} />
          ) : banks.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900">Aucune banque trouvée</h3>
              <p className="mt-1 text-sm text-slate-500">
                Ajustez vos critères de recherche ou ajoutez une nouvelle banque.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {banks.map((bank) => {
                const bankLocations = expandedBanks.has(bank.id)
                  ? locations.filter((l) => l.bankId === bank.id)
                  : []
                const bankCards = expandedBanks.has(bank.id) 
                  ? cards.filter((c) => c.bankId === bank.id) 
                  : []

                return (
                  <Card key={bank.id} className="border-l-4 border-l-blue-500">
                    <Collapsible open={expandedBanks.has(bank.id)} onOpenChange={() => toggleBankExpansion(bank.id)}>
                      <CardHeader className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleBankExpansion(bank.id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {expandedBanks.has(bank.id) ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <div className="text-left">
                              <CardTitle className="text-lg">{bank.name}</CardTitle>
                              <CardDescription>
                                ID: {bank.id} • {bank.code} • {displayValue(bank.country)} • {displayValue(bank.swiftCode)}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={bank.isActive ? "default" : "secondary"}>
                              {bank.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleStatus(bank)
                                }}
                              >
                                {bank.isActive ? "Désactiver" : "Activer"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEdit(bank)
                                }}
                              >
                                Modifier
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(bank.id)
                                }}
                              >
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <Separator className="mb-4" />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold mb-2">Informations de contact</h4>
                              <div className="space-y-1 text-sm">
                                <p>
                                  <strong>Adresse:</strong> {displayValue(bank.address)}
                                </p>
                                <p>
                                  <strong>Téléphone:</strong> {displayValue(bank.phone)}
                                </p>
                                <p>
                                  <strong>Email:</strong> {displayValue(bank.email)}
                                </p>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Emplacements associés</h4>
                              {bankLocations.length > 0 ? (
                                <div className="space-y-1">
                                  {bankLocations.map((location) => (
                                    <Badge key={location.id} variant="outline" className="mr-1 mb-1">
                                      {location.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">N/A</p>
                              )}
                            </div>
                          </div>
                          {bankCards.length > 0 ? (
                            <div className="mt-4">
                              <h4 className="font-semibold mb-2">Cartes associées</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {bankCards.map((card) => (
                                  <div
                                    key={card.id}
                                    className="flex items-center justify-between p-2 bg-slate-50 rounded"
                                  >
                                    <span className="text-sm font-medium">
                                      {card.name} ({card.type} – {card.subType} – {card.subSubType})
                                    </span>
                                    <Badge variant="secondary">{card.quantity} restantes</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4">
                              <h4 className="font-semibold mb-2">Cartes associées</h4>
                              <p className="text-sm text-slate-500">N/A</p>
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Importer des banques</DialogTitle>
            <DialogDescription>Importez un fichier CSV contenant la liste des banques à ajouter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Fichier CSV</Label>
              <Input id="file" type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} />
              <p className="text-sm text-slate-500 mt-1">
                Format attendu: CodeBanque;NomBanque;Pays;SwiftCode;Adresse;Telephone;Email
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
                      ✅ {importResults.success.length} banque(s) importée(s) avec succès
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
