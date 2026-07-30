"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
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
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"
import type { Card as CardData, Bank, CardFilters, CardImportRow, CardDetails } from "@/lib/types"
import { ChevronDown, ChevronRight, Download, Upload, Search, Filter, Printer } from "lucide-react"
import { getAuthHeaders } from "@/lib/api-client"
import { ListSkeleton } from "@/components/ui/loading-skeleton"
import { toast } from "@/hooks/use-toast"
import { useConfirmation } from "@/hooks/use-confirmation"
import { usePermissions } from "@/hooks/use-permissions"
import { documentImprimable, enteteHtml } from "@/lib/print-layout"

export default function CardsManagement() {
  const { demanderConfirmation, dialogueConfirmation } = useConfirmation()
  const { user: currentUser } = usePermissions()
  const [logoPath, setLogoPath] = useState<string>('/placeholder-logo.png')
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
  const [importResults, setImportResults] = useState<{ success: CardData[]; errors: string[]; created?: number; updated?: number; rejected?: number; imported?: number; message?: string } | null>(null)
  const [groupedCards, setGroupedCards] = useState<{ [bankName: string]: CardDetails[] }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadConfig = async () => {
    try {
      const configResponse = await fetch('/api/config', { headers: getAuthHeaders() })
      const configData = await configResponse.json()
      if (configData.success && configData.data?.general?.logo) {
        setLogoPath(configData.data.general.logo)
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Charger TOUTES les cartes pour extraire les types/sous-types (sans filtres)
      const allCardsResponse = await fetch('/api/cards', { headers: getAuthHeaders() })
      const allCardsData = await allCardsResponse.json()
      if (allCardsData.success) {
        // Extraire les types uniques de TOUTES les cartes
        const types = Array.from(new Set(allCardsData.data.map((c: any) => c.type)))
        const subTypes = Array.from(new Set(allCardsData.data.map((c: any) => c.subType)))
        const subSubTypes = Array.from(new Set(allCardsData.data.map((c: any) => c.subSubType)))
        setCardTypes(types as string[])
        setCardSubTypes(subTypes as string[])
        setCardSubSubTypes(subSubTypes as string[])
      }

      // Charger les cartes filtrées
      const params = new URLSearchParams()
      if (filters.bankId) params.append('bankId', filters.bankId)
      if (filters.type) params.append('type', filters.type)
      if (filters.subType) params.append('subType', filters.subType)
      if (filters.subSubType) params.append('subSubType', filters.subSubType)
      if (filters.lowStock) params.append('lowStock', 'true')
      if (filters.searchTerm) params.append('search', filters.searchTerm)

      const cardsResponse = await fetch(`/api/cards?${params.toString()}`, { headers: getAuthHeaders() })
      const cardsData = await cardsResponse.json()
      if (cardsData.success) {
        setCards(cardsData.data || [])
      }

      // Charger les banques actives
      const banksResponse = await fetch('/api/banks?status=active', { headers: getAuthHeaders() })
      const banksData = await banksResponse.json()
      if (banksData.success) {
        setBanks(banksData.data || [])
      }

      // Grouper les cartes par banque avec la structure CardDetails
      if (cardsData.success && banksData.success) {
        const grouped: any = {}
        
        // Grouper uniquement les cartes filtrées par leur banque
        cardsData.data.forEach((card: any) => {
          const bank = banksData.data.find((b: any) => b.id === card.bankId)
          if (bank) {
            const bankName = bank.name
            if (!grouped[bankName]) {
              grouped[bankName] = []
            }
            grouped[bankName].push({
              card: card,
              remainingQuantity: card.quantity,
              perLocation: (card.stockLevels || []).map((sl: any) => ({
                locationId: sl.location?.id,
                locationName: sl.location?.name,
                quantity: sl.quantity
              }))
            })
          }
        })
        
        setGroupedCards(grouped)
      }
    } catch (error) {
      console.error('Error loading cards:', error)
    }
    setIsLoading(false)
  }

  const { isRefreshing: isSyncRefreshing } = useDataSync(["cards", "banks"], loadData)
  const { isRefreshing: isAutoRefreshing } = useAutoRefresh(loadData, 120000) // 2 minutes
  const isRefreshing = isSyncRefreshing || isAutoRefreshing

  useEffect(() => {
    loadConfig()
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
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...formData,
            quantity: editingCard.quantity,
            isActive: true,
          })
        })
        const data = await response.json()
        if (!data.success) {
          toast({ title: "Mise à jour impossible", description: data.error, variant: "destructive" })
          return
        }
      } else {
        const response = await fetch('/api/cards', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...formData,
            quantity: 0,
            isActive: true,
          })
        })
        const data = await response.json()
        if (!data.success) {
          toast({ title: "Création impossible", description: data.error, variant: "destructive" })
          return
        }
      }

      toast({
        title: editingCard ? "Carte mise à jour" : "Carte créée",
        description: `${formData.name} a été enregistrée.`,
        variant: "success",
      })
      await loadData()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving card:', error)
      toast({
        title: "Enregistrement impossible",
        description: "Une erreur est survenue pendant la sauvegarde de la carte.",
        variant: "destructive",
      })
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
      maxThreshold: 100000,
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
    // Vérifier d'abord si la carte a du stock
    const card = cards.find(c => c.id === id)
    if (!card) return

    const stockLevels = (card as any).stockLevels || []
    const totalStock = stockLevels.reduce((sum: number, level: any) => sum + level.quantity, 0)

    if (totalStock > 0) {
      toast({
        title: "Impossible de supprimer cette carte",
        description: `Elle contient encore ${totalStock} unité(s) en stock dans les emplacements. Transférez ou sortez ce stock avant de supprimer la carte.`,
        variant: "destructive",
      })
      return
    }

    const confirme = await demanderConfirmation({
      title: "Supprimer cette carte ?",
      description: `${card.name} sera définitivement supprimée.`,
      confirmLabel: "Supprimer",
      variant: "danger",
    })
    if (!confirme) return

    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        toast({ title: "Carte supprimée", description: card.name, variant: "success" })
        await loadData()
      } else {
        toast({ title: "Suppression impossible", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      console.error('Error deleting card:', error)
      toast({
        title: "Suppression impossible",
        description: "Une erreur est survenue pendant la suppression de la carte.",
        variant: "destructive",
      })
    }
  }

  const downloadTemplate = () => {
    const csvContent =
      "ID;BanqueEmettrice;NomCarte;Type;SousType;SousSousType\n;Banque Internationale;Carte Débit Jeune;Carte débit;Mastercard;National\n;Banque Internationale;Carte Débit Gold;Carte débit;Mastercard;International\n;Banque Centrale;Carte Débit Standard;Carte débit;Visa;National"

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

  const handleExport = () => {
    // Créer le header
    const headers = "ID;BanqueEmettrice;NomCarte;Type;SousType;SousSousType"
    
    // Créer les lignes de données
    const rows = cards.map(card => {
      const bankName = (card as any).bank?.name || banks.find(b => b.id === card.bankId)?.name || ''
      return `${card.id};${bankName};${card.name};${card.type};${card.subType};${card.subSubType}`
    })
    
    // Combiner header et rows
    const csvContent = [headers, ...rows].join('\n')

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `export_cartes_${new Date().toISOString().split('T')[0]}.csv`)
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

    const raw = await importFile.text()
    // Normaliser les retours chariot et supprimer un éventuel BOM
    const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const lines = normalized.split("\n").filter((line) => line.trim().length > 0)
    let headerLine = (lines[0] || "").replace(/^\uFEFF/, "").trim()

    // Détecter automatiquement le séparateur: priorité ; puis , puis tabulation
    const detectDelimiter = (sample: string): string => {
      if (sample.includes(";")) return ";"
      if (sample.includes(",")) return ","
      return "\t"
    }
    const delimiter = detectDelimiter(headerLine)

    // Nettoyer les guillemets éventuels
    const sanitizeCell = (value: string) => value.replace(/^\s*\"|\"\s*$/g, "").trim()

    const headers = headerLine.split(delimiter).map((h) => sanitizeCell(h))

    // Valider la présence des en-têtes requis (ID est optionnel)
    const requiredHeaders = [
      "BanqueEmettrice",
      "NomCarte",
      "Type",
      "SousType",
      "SousSousType",
    ]
    
    // Vérifier si la colonne ID est présente (optionnelle)
    const hasIdColumn = headers.includes("ID")
    
    // Valider uniquement les en-têtes obligatoires
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h))
    if (missingHeaders.length > 0) {
      const expectedFormat = hasIdColumn 
        ? `ID;${requiredHeaders.join(";")}`
        : requiredHeaders.join(";")
      setImportResults({ success: [], errors: [
        `En-têtes manquants: ${missingHeaders.join(", ")}. Format attendu: ${expectedFormat}`,
      ]})
      return
    }

    const cards: CardImportRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = (lines[i] || "").trim()
      if (!line) continue
      const values = line.split(delimiter)
      const card: any = {}

      headers.forEach((header, index) => {
        const key = header.trim()
        const value = sanitizeCell((values[index] ?? "").trim())
        card[key] = value
      })

      cards.push(card as CardImportRow)
    }

    try {
      const response = await fetch('/api/cards/import', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: cards })
      })
      const data = await response.json()
      
      setImportResults({
        success: data.imported > 0 ? new Array(data.created || 0).fill({}) as any : [],
        errors: data.errors || [],
        created: data.created,
        updated: data.updated,
        rejected: data.rejected,
        imported: data.imported,
        message: data.message,
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
      bankId: undefined,
      type: undefined,
      subType: undefined,
      subSubType: undefined,
      lowStock: false,
    })
  }

  const nomUtilisateurCourant = () =>
    currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "N/A"

  const formatHorodatage = () =>
    new Date().toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    })

  // Tableau du détail des cartes d'une banque. Chaque ligne porte toutes ses
  // colonnes (pas de rowspan sur le type) : le paginateur découpe un tableau
  // trop long ligne à ligne, et une cellule fusionnée n'ayant plus son ancre
  // en cas de coupure laisserait un tableau incohérent sur la page suivante.
  const tableauCartesBanque = (bankCards: CardDetails[]) => {
    const triees = [...bankCards].sort((a, b) => {
      const cardA = a.card
      const cardB = b.card
      if (cardA.type !== cardB.type) return cardA.type.localeCompare(cardB.type)
      if (cardA.subType !== cardB.subType) return cardA.subType.localeCompare(cardB.subType)
      if (cardA.subSubType !== cardB.subSubType) return cardA.subSubType.localeCompare(cardB.subSubType)
      return cardA.name.localeCompare(cardB.name)
    })
    const total = triees.reduce((somme, cd) => somme + (cd.card.quantity || 0), 0)

    return `
      <table>
        <thead><tr>
          <th>Type</th><th>Sous-type</th><th>Sous-sous-type</th><th>Nom de la carte</th><th class="num">Quantité</th>
        </tr></thead>
        <tbody>
          ${triees.map((cd) => `<tr>
              <td>${cd.card.type}</td>
              <td>${cd.card.subType}</td>
              <td>${cd.card.subSubType}</td>
              <td>${cd.card.name}</td>
              <td class="num">${cd.card.quantity}</td>
            </tr>`).join('')}
          <tr class="ligne-total">
            <td colspan="4">Total</td>
            <td class="num">${total}</td>
          </tr>
        </tbody>
      </table>`
  }

  const blocDestinataire = `
    <div class="destinataire">
      <h3>Destinataire :</h3>
      <div class="ligne-champs">
        <div class="champ"><p>Nom :</p><div class="trait"></div></div>
        <div class="champ"><p>Prénom :</p><div class="trait"></div></div>
      </div>
      <div class="ligne-champs">
        <div class="champ"><p>Fonction :</p><div class="trait"></div></div>
        <div class="champ"><p>Date :</p><div class="trait"></div></div>
      </div>
    </div>`

  const handlePrint = () => {
    const banquesAvecCartes = Object.entries(groupedCards).filter(([, bankCards]) => bankCards.length > 0)
    const totalTypes = banquesAvecCartes.reduce((somme, [, bankCards]) => somme + bankCards.length, 0)
    const totalQuantite = banquesAvecCartes.reduce(
      (somme, [, bankCards]) => somme + bankCards.reduce((s, cd) => s + (cd.card.quantity || 0), 0),
      0,
    )

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const sections = banquesAvecCartes
      .map(([bankName, bankCards]) => `
        <section>
          <h3 class="section">${bankName}</h3>
          ${tableauCartesBanque(bankCards)}
        </section>`)
      .join('')

    const blocs = `
      ${enteteHtml(logoPath)}
      <div class="titre-document"><h2>Détail des Cartes en Stock</h2></div>
      <div class="info-gauche">
        <p>Généré le ${formatHorodatage()} par ${nomUtilisateurCourant()}</p>
        <p><strong>Total :</strong> ${totalTypes} type${totalTypes > 1 ? 's' : ''} de carte${totalTypes > 1 ? 's' : ''} sur ${totalQuantite} carte${totalQuantite > 1 ? 's' : ''} au total</p>
      </div>
      ${sections || '<section><h3 class="section">Cartes</h3><table><tbody><tr><td>Aucune carte à afficher</td></tr></tbody></table></section>'}
      ${blocDestinataire}`

    printWindow.document.write(documentImprimable({ titreOnglet: "Détail des Cartes en Stock", blocs }))
    printWindow.document.close()
  }

  const handlePrintInventory = () => {
    const inventoryData = Object.entries(groupedCards).map(([bankName, bankCards]) => {
      const totalQuantity = bankCards.reduce((sum, cd) => sum + cd.card.quantity, 0)
      const lowStockCount = bankCards.filter((cd) => cd.card.quantity <= cd.card.minThreshold).length
      const typeBreakdown: { [type: string]: number } = {}

      bankCards.forEach((cd) => {
        typeBreakdown[cd.card.type] = (typeBreakdown[cd.card.type] || 0) + cd.card.quantity
      })

      return { bankName, nbTypes: bankCards.length, totalQuantity, lowStockCount, typeBreakdown }
    })

    const grandTotal = {
      nbTypes: Object.values(groupedCards).reduce((sum, cards) => sum + cards.length, 0),
      totalQuantity: Object.values(groupedCards).reduce(
        (sum, cards) => sum + cards.reduce((cardSum, cd) => cardSum + cd.card.quantity, 0),
        0,
      ),
      lowStockCount: Object.values(groupedCards).reduce(
        (sum, cards) => sum + cards.filter((cd) => cd.card.quantity <= cd.card.minThreshold).length,
        0,
      ),
    }

    const lignes = inventoryData
      .map((inv) => `
        <tr>
          <td>${inv.bankName}</td>
          <td class="num">${inv.nbTypes}</td>
          <td class="num">${inv.totalQuantity}</td>
          <td class="num">${
            inv.lowStockCount > 0
              ? `<span style="color:#dc2626; font-weight:bold">${inv.lowStockCount} alerte${inv.lowStockCount > 1 ? 's' : ''}</span>`
              : 'OK'
          }</td>
          <td>${Object.entries(inv.typeBreakdown).map(([type, qty]) => `<div>${type} : ${qty}</div>`).join('')}</td>
        </tr>`)
      .join('')

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const blocs = `
      ${enteteHtml(logoPath)}
      <div class="titre-document"><h2>Rapport d'Inventaire par Banque</h2></div>
      <div class="info-gauche">
        <p>Généré le ${formatHorodatage()} par ${nomUtilisateurCourant()}</p>
        <p><strong>Nombre de banques :</strong> ${inventoryData.length} • <strong>Total types :</strong> ${grandTotal.nbTypes} • <strong>Quantité totale :</strong> ${grandTotal.totalQuantity}</p>
      </div>
      <section>
        <h3 class="section">Détail par banque</h3>
        <table>
          <thead><tr>
            <th>Banque</th><th class="num">Nb types</th><th class="num">Quantité totale</th><th class="num">Stock faible</th><th>Répartition par type</th>
          </tr></thead>
          <tbody>
            ${lignes || '<tr><td colspan="5">Aucune banque à afficher</td></tr>'}
            <tr class="ligne-total">
              <td>Total général</td>
              <td class="num">${grandTotal.nbTypes}</td>
              <td class="num">${grandTotal.totalQuantity}</td>
              <td class="num">${grandTotal.lowStockCount}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </section>
      ${blocDestinataire}`

    printWindow.document.write(documentImprimable({ titreOnglet: "Rapport d'Inventaire par Banque", blocs }))
    printWindow.document.close()
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
    maxThreshold: 100000,
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
          <p className="text-xs text-[#008DA8]">
            Gérez votre inventaire de cartes avec hiérarchie Type → Sous-type → Sous-sous-type
          </p>
          {isRefreshing && <p className="text-sm text-blue-600">Actualisation en cours...</p>}
        </div>
        <div className="flex gap-2">
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
            Imprimer Détails
          </Button>
          <Button variant="outline" onClick={handlePrintInventory}>
            <Printer className="h-4 w-4 mr-2" />
            Rapport Inventaire
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
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                      required
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Visa">Visa</SelectItem>
                        <SelectItem value="Mastercard">Mastercard</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="JCB">JCB</SelectItem>
                        <SelectItem value="White Label">White Label</SelectItem>
                        <SelectItem value="Amex">Amex</SelectItem>
                        <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
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
                      placeholder="ex. Nationale"
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
                      placeholder="ex. Nom de la carte"
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
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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

      {/* Tableau Récapitulatif Inventaire par Banque */}
      <Card>
        <CardHeader>
          <CardTitle>Inventaire Récapitulatif par Banque</CardTitle>
          <CardDescription>
            Vue d'ensemble des stocks par banque partenaire
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-100">
                  <th className="text-left p-3 font-semibold text-slate-700">Banque</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Nb Types de Cartes</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Quantité Totale</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Stock Faible</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedCards).map(([bankName, bankCards]) => {
                  const totalQuantity = bankCards.reduce((sum, cd) => sum + cd.card.quantity, 0)
                  const lowStockCount = bankCards.filter(cd => cd.card.quantity <= cd.card.minThreshold).length
                  return (
                    <tr key={bankName} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">{bankName}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline">{bankCards.length}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="default" className="font-mono">{totalQuantity}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        {lowStockCount > 0 ? (
                          <Badge variant="destructive">{lowStockCount} alerte(s)</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="default" className="bg-green-600">Active</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                  <td className="p-3 text-slate-900">TOTAL GÉNÉRAL</td>
                  <td className="p-3 text-center text-slate-900">
                    {Object.values(groupedCards).reduce((total, cards) => total + cards.length, 0)}
                  </td>
                  <td className="p-3 text-center text-slate-900">
                    {Object.values(groupedCards).reduce((total, cards) => 
                      total + cards.reduce((sum, cd) => sum + cd.card.quantity, 0), 0
                    )}
                  </td>
                  <td className="p-3 text-center text-slate-900">
                    {Object.values(groupedCards).reduce((total, cards) => 
                      total + cards.filter(cd => cd.card.quantity <= cd.card.minThreshold).length, 0
                    )}
                  </td>
                  <td className="p-3 text-center"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cards List - Grouped by Bank */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des Cartes par Banque</CardTitle>
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
                                  <Link
                                    href={`/dashboard/cards/${card.id}`}
                                    className="font-medium text-[#008DA8] hover:underline"
                                  >
                                    {card.name}
                                  </Link>
                              <div className="text-sm text-slate-600">
                                ID: {card.id} • {card.type} – {card.subType} – {card.subSubType}
                              </div>
                              {Array.isArray((cardDetail as any).perLocation) && (cardDetail as any).perLocation.length > 0 && (
                                <div className="mt-1 text-xs text-slate-600">
                                  {(cardDetail as any).perLocation.map((pl: any) => (
                                    <div key={pl.locationId} className="flex justify-between">
                                      <span>• {pl.locationName}</span>
                                      <span className="tabular-nums">{pl.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
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
                {(importResults.created || importResults.updated) ? (
                  <div className="p-3 bg-green-50 rounded">
                    <p className="text-sm font-medium text-green-800">
                      ✅ Import terminé: {importResults.created || 0} créée(s), {importResults.updated || 0} mise(s) à jour, {importResults.rejected || 0} rejetée(s)
                    </p>
                    {importResults.message && (
                      <p className="text-xs text-green-700 mt-1">{importResults.message}</p>
                    )}
                  </div>
                ) : null}
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
