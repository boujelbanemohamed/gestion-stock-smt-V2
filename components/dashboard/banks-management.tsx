"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
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
import { authenticatedFetch } from "@/lib/api-client"
import { toast } from "@/hooks/use-toast"
import { useConfirmation } from "@/hooks/use-confirmation"
import { parseCsvLine } from "@/lib/csv"
import { usePermissions } from "@/hooks/use-permissions"
import { documentImprimable, enteteHtml } from "@/lib/print-layout"

export default function BanksManagement() {
  const { demanderConfirmation, dialogueConfirmation } = useConfirmation()
  const { user: currentUser } = usePermissions()
  const [logoPath, setLogoPath] = useState<string>('/placeholder-logo.png')
  const searchParams = useSearchParams()
  const [banks, setBanks] = useState<Bank[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())
  // Pré-rempli dès le premier rendu avec ?q=... (recherche globale) pour éviter
  // qu'un premier fetch non filtré ne parte en parallèle de celui, filtré, déclenché
  // par un effet séparé (l'un des deux résultats écrasant l'autre selon l'ordre de retour réseau).
  const [filters, setFilters] = useState<BankFilters>({
    status: "all",
    searchTerm: searchParams.get("q") || "",
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

  // Compteur de séquence : protège contre le cas où deux requêtes se
  // chevauchent (ex. réseau lent) — sans lui, une réponse plus ancienne
  // arrivée après une plus récente écraserait le résultat affiché par un
  // résultat obsolète.
  const loadSeqRef = useRef(0)

  const loadConfig = async () => {
    try {
      const configResponse = await authenticatedFetch('/api/config')
      const configData = await configResponse.json()
      if (configData.success && configData.data?.general?.logo) {
        setLogoPath(configData.data.general.logo)
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const loadBanks = async () => {
    const seq = ++loadSeqRef.current
    setIsLoading(true)
    try {
      // Construire l'URL avec les filtres
      const params = new URLSearchParams()
      if (filters.country) params.append('country', filters.country)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.searchTerm) params.append('search', filters.searchTerm)

      const response = await authenticatedFetch(`/api/banks?${params.toString()}`)
      const data = await response.json()
      if (seq !== loadSeqRef.current) return // une requête plus récente a déjà démarré

      if (data.success) {
        setBanks(data.data || [])

        // Extraire les pays uniques
        const uniqueCountries = Array.from(new Set(data.data.map((b: Bank) => b.country)))
        setCountries(uniqueCountries as string[])
      }

      // Charger aussi les locations et cartes pour l'affichage des détails
      const locationsResponse = await authenticatedFetch('/api/locations')
      const locationsData = await locationsResponse.json()
      if (seq !== loadSeqRef.current) return
      if (locationsData.success) {
        setLocations(locationsData.data || [])
      }

      const cardsResponse = await authenticatedFetch('/api/cards')
      const cardsData = await cardsResponse.json()
      if (seq !== loadSeqRef.current) return
      if (cardsData.success) {
        setCards(cardsData.data || [])
      }
    } catch (error) {
      console.error('Error loading banks:', error)
    }
    if (seq === loadSeqRef.current) setIsLoading(false)
  }

  const { isRefreshing: isSyncRefreshing } = useDataSync(["banks"], loadBanks)
  const { isRefreshing: isAutoRefreshing, lastRefresh } = useAutoRefresh(loadBanks, 120000) // 2 minutes

  const isRefreshing = isSyncRefreshing || isAutoRefreshing

  // Retardé (300 ms) pour ne pas déclencher un appel réseau à chaque frappe
  // dans le champ de recherche — sauf quand la recherche redevient vide
  // (ex. clic sur Réinitialiser), où on recharge immédiatement. Un
  // changement de filtre pendant le délai annule l'appel encore programmé
  // (cleanup), avant même qu'il ne parte.
  useEffect(() => {
    const timer = setTimeout(loadBanks, filters.searchTerm ? 300 : 0)
    return () => clearTimeout(timer)
  }, [filters.country, filters.status, filters.searchTerm])

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
        const response = await authenticatedFetch(`/api/banks/${editingBank.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...formData, isActive: true })
        })
        const data = await response.json()
        if (!data.success) {
          toast({ title: "Mise à jour impossible", description: data.error, variant: "destructive" })
          return
        }
      } else {
        const response = await authenticatedFetch('/api/banks', {
          method: 'POST',
          body: JSON.stringify({ ...formData, isActive: true })
        })
        const data = await response.json()
        if (!data.success) {
          toast({ title: "Création impossible", description: data.error, variant: "destructive" })
          return
        }
      }

      toast({
        title: editingBank ? "Banque mise à jour" : "Banque créée",
        description: `${formData.name} a été enregistrée.`,
        variant: "success",
      })
      await loadBanks()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving bank:', error)
      toast({
        title: "Enregistrement impossible",
        description: "Une erreur est survenue pendant la sauvegarde de la banque.",
        variant: "destructive",
      })
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
    const banque = banks.find((b) => b.id === id)
    const confirme = await demanderConfirmation({
      title: "Supprimer cette banque ?",
      description: `${banque?.name ?? "Cette banque"} sera définitivement supprimée.`,
      confirmLabel: "Supprimer",
      variant: "danger",
    })
    if (!confirme) return

    try {
      const response = await authenticatedFetch(`/api/banks/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        toast({ title: "Banque supprimée", variant: "success" })
        await loadBanks()
      } else {
        toast({ title: "Suppression impossible", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      console.error('Error deleting bank:', error)
      toast({
        title: "Suppression impossible",
        description: "Une erreur est survenue pendant la suppression de la banque.",
        variant: "destructive",
      })
    }
  }

  const handleToggleStatus = async (bank: Bank) => {
    const action = bank.isActive ? "désactiver" : "activer"
    const message = bank.isActive
      ? "Êtes-vous sûr de vouloir désactiver cette banque ? Vous ne pourrez plus ajouter de cartes, d'emplacements ou effectuer de mouvements affiliés à cette banque."
      : "Êtes-vous sûr de vouloir activer cette banque ?"

    const confirme = await demanderConfirmation({
      title: bank.isActive ? "Désactiver cette banque ?" : "Activer cette banque ?",
      description: message,
      confirmLabel: bank.isActive ? "Désactiver" : "Activer",
      variant: bank.isActive ? "danger" : "default",
    })
    if (!confirme) return

    try {
      const response = await authenticatedFetch(`/api/banks/${bank.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !bank.isActive })
      })
      const data = await response.json()
      if (data.success) {
        toast({
          title: bank.isActive ? "Banque désactivée" : "Banque activée",
          description: bank.name,
          variant: "success",
        })
        await loadBanks()
      } else {
        toast({
          title: `Impossible de ${action} la banque`,
          description: data.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error toggling bank status:', error)
      toast({
        title: `Impossible de ${action} la banque`,
        description: "Une erreur est survenue pendant la mise à jour du statut.",
        variant: "destructive",
      })
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
      const headers = parseCsvLine(lines[0], ";")

      const banks: BankImportRow[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i], ";")
        const bank: any = {}

        headers.forEach((header, index) => {
          bank[header.trim()] = values[index]?.trim() || ""
        })

        banks.push(bank as BankImportRow)
      }

      // Appeler l'API d'import
      const response = await authenticatedFetch('/api/banks/import', {
        method: 'POST',
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

  const nomUtilisateurCourant = () =>
    currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "N/A"

  const formatHorodatage = () =>
    new Date().toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    })

  const blocSignatures = `
    <section>
      <h3 class="section">Signatures</h3>
      <div class="ligne-champs">
        <div class="champ"><p>Signature 1 :</p><div class="trait"></div></div>
        <div class="champ"><p>Signature 2 :</p><div class="trait"></div></div>
        <div class="champ"><p>Signature 3 :</p><div class="trait"></div></div>
      </div>
    </section>`

  // Détails d'une banque : un tableau court (une petite dizaine de lignes au
  // plus), qui tient toujours sur une page — pas besoin de le laisser au
  // paginateur, qui ne sait de toute façon découper qu'un <section> à une
  // seule table (voir tableauCartesBanque ci-dessous pour celle qui peut
  // vraiment déborder).
  const tableauDetailsBanque = (bank: Bank, locationNames: string) => `
    <table><tbody>
      <tr><td class="libelle">Code</td><td>${bank.code}</td></tr>
      <tr><td class="libelle">Pays</td><td>${displayValue(bank.country)}</td></tr>
      <tr><td class="libelle">Code SWIFT</td><td>${displayValue(bank.swiftCode)}</td></tr>
      <tr><td class="libelle">Adresse</td><td>${displayValue(bank.address)}</td></tr>
      <tr><td class="libelle">Téléphone</td><td>${displayValue(bank.phone)}</td></tr>
      <tr><td class="libelle">Email</td><td>${displayValue(bank.email)}</td></tr>
      <tr><td class="libelle">Emplacements</td><td>${locationNames}</td></tr>
      <tr><td class="libelle">Statut</td><td>${bank.isActive ? "Active" : "Inactive"}</td></tr>
    </tbody></table>`

  // Détail des cartes d'une banque : table à part (et non fusionnée avec les
  // détails ci-dessus) pour que le paginateur puisse la découper ligne à
  // ligne si elle dépasse une page — il ne sait le faire que sur un
  // <section> ne contenant qu'une seule table.
  const tableauCartesDeBanque = (bankCards: any[]) => {
    const total = bankCards.reduce((somme, c) => somme + (c.quantity || 0), 0)
    return `
      <table>
        <thead><tr>
          <th>Nom</th><th>Type</th><th>Sous-type</th><th>Sous-sous-type</th>
          <th class="num">Quantité</th><th>Statut</th>
        </tr></thead>
        <tbody>
          ${bankCards.length > 0
            ? bankCards.map((card) => `<tr>
                <td>${card.name}</td>
                <td>${card.type}</td>
                <td>${displayValue(card.subType)}</td>
                <td>${displayValue(card.subSubType)}</td>
                <td class="num">${card.quantity || 0}</td>
                <td>${card.isActive ? "Active" : "Inactive"}</td>
              </tr>`).join("")
            : '<tr><td colspan="6">Aucune carte</td></tr>'}
          <tr class="ligne-total">
            <td colspan="4">Total</td><td class="num">${total}</td><td></td>
          </tr>
        </tbody>
      </table>`
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const sections = banks
      .map((bank) => {
        const bankLocations = locations.filter((l) => l.bankId === bank.id)
        const locationNames = bankLocations.length > 0
          ? bankLocations.map((l) => l.name).join(", ")
          : "N/A"
        const bankCards = cards.filter((c) => c.bankId === bank.id)

        return `
          <section>
            <h3 class="section">${bank.code} - ${bank.name}</h3>
            ${tableauDetailsBanque(bank, locationNames)}
          </section>
          <section>
            <h3 class="section">Détail des cartes (${bankCards.length})</h3>
            ${tableauCartesDeBanque(bankCards)}
          </section>`
      })
      .join("")

    const blocs = `
      ${enteteHtml(logoPath)}
      <div class="titre-document"><h2>Liste des Banques Partenaires et Détail des Cartes</h2></div>
      <div class="info-gauche">
        <p>Généré le ${formatHorodatage()} par ${nomUtilisateurCourant()}</p>
        <p><strong>Total :</strong> ${banks.length} banque${banks.length > 1 ? "s" : ""}</p>
      </div>
      ${sections || '<section><h3 class="section">Banques</h3><table><tbody><tr><td>Aucune banque à afficher</td></tr></tbody></table></section>'}
      ${blocSignatures}`

    printWindow.document.write(
      documentImprimable({ titreOnglet: "Liste des Banques Partenaires et Détail des Cartes", blocs }),
    )
    printWindow.document.close()
  }

  const displayValue = (value: string | undefined | null): string => {
    return value && value.trim() !== "" ? value : "N/A"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Banques</h2>
          <p className="text-xs text-[#008DA8]">Gérez vos banques partenaires</p>
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
                      {/* Pas de CollapsibleTrigger (bouton natif) ici : cet en-tête contient déjà
                          des boutons d'action (activer/modifier/supprimer), et un bouton ne peut
                          pas légalement en contenir d'autres. On rend donc ce div accessible au
                          clavier nous-mêmes (role, tabIndex, Entrée/Espace). */}
                      <CardHeader
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => toggleBankExpansion(bank.id)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={expandedBanks.has(bank.id)}
                        aria-label={`Afficher le détail de ${bank.name}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            toggleBankExpansion(bank.id)
                          }
                        }}
                      >
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

      {dialogueConfirmation}
    </div>
  )
}
