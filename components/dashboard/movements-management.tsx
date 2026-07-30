"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"
import type { Movement, Card as CardType, Location, Bank, MovementReason } from "@/lib/types"
import { Filter, ChevronLeft, ChevronRight, Paperclip, Download, Trash2 } from "lucide-react"
import { authenticatedFetch } from "@/lib/api-client"
import { toast } from "@/hooks/use-toast"
import { ADRESSE_SOCIETE, documentImprimable, enteteHtml } from "@/lib/print-layout"
import { cn } from "@/lib/utils"
import { exportToCsv, exportToExcel } from "@/lib/export"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const FIELD_LABELS: Record<string, string> = {
  bankId: "Banque",
  cardQuantities: "Cartes",
  fromLocationId: "Emplacement source",
  toLocationId: "Emplacement destination",
  reason: "Motif",
  quantity: "Quantité",
}

function showValidationErrorsToast(errors: Record<string, string | undefined>) {
  const entries = Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1]))
  toast({
    title: "Erreurs de validation",
    description: (
      <ul className="list-disc space-y-0.5 pl-4">
        {entries.map(([key, message]) => (
          <li key={key}>
            <strong>{FIELD_LABELS[key] || key} :</strong> {message}
          </li>
        ))}
      </ul>
    ),
    variant: "destructive",
  })
}
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"

export default function MovementsManagement() {
  const searchParams = useSearchParams()
  const prefillCardId = searchParams.get("cardId")
  const hasPrefilledRef = useRef(false)
  const [movements, setMovements] = useState<Movement[]>([])
  const [cards, setCards] = useState<CardType[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [movementReasons, setMovementReasons] = useState<MovementReason[]>([])
  const [selectedReasonId, setSelectedReasonId] = useState<string>("")
  const [banks, setBanks] = useState<Bank[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [logoPath, setLogoPath] = useState<string>('/placeholder-logo.png')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    bankId: "",
    cardQuantities: [] as { cardId: string; quantity: number }[], // Quantité par carte
    fromLocationId: "",
    toLocationId: "",
    movementType: "entry" as "entry" | "exit" | "transfer",
    reason: "",
  })

  // Document justificatif optionnel, uniquement pour les mouvements d'entrée.
  // Géré à part de formData car un objet File ne doit pas transiter par le JSON
  // envoyé pour chaque mouvement créé en masse.
  const [documentFile, setDocumentFile] = useState<File | null>(null)

  const [movementErrors, setMovementErrors] = useState<Array<{
    cardName: string
    error: string
  }>>([])

  const [formErrors, setFormErrors] = useState<{
    quantity?: string
    fromLocationId?: string
    toLocationId?: string
    reason?: string
  }>({})
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false)

  // Suppression d'un mouvement : le mouvement visé par la confirmation en cours.
  const [movementToDelete, setMovementToDelete] = useState<Movement | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // États pour les filtres
  const [filters, setFilters] = useState({
    bankId: "all",
    cardId: "all",
    movementType: "all",
    fromLocationId: "all",
    toLocationId: "all",
    dateFrom: "",
    dateTo: "",
    searchTerm: ""
  })

  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalMovements, setTotalMovements] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const movementsPerPage = 30

  useEffect(() => {
    loadCurrentUser()
    // Charger les cartes, emplacements et banques une seule fois
    loadCardsLocationsBanks()
    // Charger la configuration pour le logo
    loadConfig()
    // Charger la liste des motifs (gérée dans Configuration > Motifs)
    loadMovementReasons()
  }, [])

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

  const loadMovementReasons = async () => {
    try {
      const response = await authenticatedFetch('/api/movement-reasons')
      const data = await response.json()
      if (data.success) {
        setMovementReasons((data.data || []).filter((r: MovementReason) => r.isActive))
      }
    } catch (error) {
      console.error('Error loading movement reasons:', error)
    }
  }

  // Recharger les mouvements quand les filtres ou la page changent
  useEffect(() => {
    loadMovements()
  }, [filters, currentPage])

  // Pré-remplir et ouvrir le formulaire "Nouveau mouvement" quand on arrive depuis
  // la fiche détaillée d'une carte (lien "Nouveau mouvement" avec ?cardId=...)
  useEffect(() => {
    if (!prefillCardId || hasPrefilledRef.current || cards.length === 0) return
    const card = cards.find((c) => c.id === prefillCardId)
    if (!card) return

    hasPrefilledRef.current = true
    setFormData((prev) => ({
      ...prev,
      bankId: card.bankId,
      cardQuantities: [{ cardId: card.id, quantity: 1 }],
    }))
    setIsDialogOpen(true)
  }, [prefillCardId, cards])

  const loadCardsLocationsBanks = async () => {
    try {
      // Charger les cartes
      const cardsResponse = await authenticatedFetch('/api/cards')
      const cardsData = await cardsResponse.json()
      if (cardsData.success) {
        setCards(cardsData.data || [])
      }

      // Charger les emplacements
      const locationsResponse = await authenticatedFetch('/api/locations')
      const locationsData = await locationsResponse.json()
      if (locationsData.success) {
        setLocations(locationsData.data.filter((l: any) => l.isActive) || [])
      }

      // Charger les banques
      const banksResponse = await authenticatedFetch('/api/banks?status=active')
      const banksData = await banksResponse.json()
      if (banksData.success) {
        setBanks(banksData.data || [])
      }
    } catch (error) {
      console.error('Error loading cards/locations/banks:', error)
    }
  }

  const loadMovements = async () => {
    try {
      // Construire les paramètres de requête avec filtres et pagination
      const params = new URLSearchParams()
      
      // Ajouter les filtres
      if (filters.bankId && filters.bankId !== "all") {
        params.append('bankId', filters.bankId)
      }
      if (filters.cardId && filters.cardId !== "all") {
        params.append('cardId', filters.cardId)
      }
      if (filters.movementType && filters.movementType !== "all") {
        params.append('type', filters.movementType)
      }
      if (filters.fromLocationId && filters.fromLocationId !== "all") {
        params.append('fromLocationId', filters.fromLocationId)
      }
      if (filters.toLocationId && filters.toLocationId !== "all") {
        params.append('toLocationId', filters.toLocationId)
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom)
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo)
      }
      if (filters.searchTerm) {
        params.append('searchTerm', filters.searchTerm)
      }
      
      // Ajouter la pagination
      params.append('page', currentPage.toString())
      params.append('limit', movementsPerPage.toString())

      // Charger les mouvements avec filtres et pagination
      const movementsResponse = await authenticatedFetch(`/api/movements?${params.toString()}`)
      const movementsData = await movementsResponse.json()
      if (movementsData.success && movementsData.data) {
        // S'assurer que movements est toujours un tableau
        const movementsArray = Array.isArray(movementsData.data.movements) 
          ? movementsData.data.movements 
          : (Array.isArray(movementsData.data) ? movementsData.data : [])
        setMovements(movementsArray)
        setTotalMovements(movementsData.data.total || 0)
        setTotalPages(movementsData.data.totalPages || 1)
      } else {
        // En cas d'erreur, s'assurer que movements reste un tableau vide
        setMovements([])
      }
    } catch (error) {
      console.error('Error loading movements:', error)
      // En cas d'erreur, s'assurer que movements reste un tableau vide
      setMovements([])
      setTotalMovements(0)
      setTotalPages(1)
    }
  }

  const loadCurrentUser = () => {
    try {
      // Récupérer l'utilisateur connecté depuis localStorage
      const userStr = localStorage.getItem('currentUser')
      if (userStr) {
        const user = JSON.parse(userStr)
        setCurrentUser(user)
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    }
  }

  // Synchronisation automatique des mouvements
  useDataSync(["movements"], loadMovements)
  // Les mouvements sont désormais poussés en temps réel (SSE, voir RealtimeBridge) ;
  // ce polling ne sert plus que de filet de sécurité en cas de coupure de la connexion.
  useAutoRefresh(loadMovements, 5 * 60000) // 5 minutes

  const getCardName = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId)
    return card ? card.name : "N/A"
  }

  const getLocationName = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId)
    return location ? location.name : "N/A"
  }

  const getUserName = (userId: string) => {
    // Récupérer le nom depuis le mouvement qui contient déjà les infos user
    const movement = Array.isArray(movements) ? movements.find(m => m.userId === userId) : null
    if (movement && (movement as any).user) {
      const user = (movement as any).user
      return `${user.firstName} ${user.lastName}`
    }
    return "N/A"
  }

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Décrit en clair le mouvement de stock qu'entraînera la suppression, pour que
  // l'utilisateur sache exactement quelle quantité part de quel emplacement.
  // La formulation suit à la lettre ce que fait DELETE /api/movements/[id] :
  // annuler une entrée retire à la destination, annuler une sortie rend à la
  // source, annuler un transfert fait les deux (retour destination -> source).
  const decrireAnnulation = (movement: Movement): string => {
    // Le verbe et le participe s'accordent avec la quantité, sinon on lit
    // « 1 carte vont être retirées ».
    const pluriel = movement.quantity > 1
    const s = pluriel ? "s" : ""
    const sujet = `${movement.quantity} carte${s} ${pluriel ? "vont" : "va"} être`
    const emplacement = (id: string) => `« ${getLocationName(id)} »`

    switch (movement.movementType) {
      case "entry":
        return movement.toLocationId
          ? `${sujet} retirée${s} de ${emplacement(movement.toLocationId)}.`
          : `${sujet} retirée${s} de l'emplacement de destination.`
      case "exit":
        return movement.fromLocationId
          ? `${sujet} remise${s} dans ${emplacement(movement.fromLocationId)}.`
          : `${sujet} remise${s} à l'emplacement d'origine.`
      case "transfer":
        return movement.fromLocationId && movement.toLocationId
          ? `${sujet} transférée${s} de ${emplacement(movement.toLocationId)} ` +
              `vers ${emplacement(movement.fromLocationId)}.`
          : `${sujet} replacée${s} à l'emplacement d'origine.`
      default:
        return `Le stock des emplacements concernés sera réajusté de ${movement.quantity} carte${s}.`
    }
  }

  const getMovementTypeLabel = (type: string) => {
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

  const getMovementTypeBadge = (type: string) => {
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

  // Impression de la liste filtrée : le détail des mouvements, deux tableaux de
  // synthèse, puis le destinataire.
  const printMovementSlip = async () => {
    if (!currentUser) return

    try {
      // Tous les mouvements correspondant aux filtres, sans pagination.
      const params = new URLSearchParams()
      if (filters.bankId && filters.bankId !== "all") params.append('bankId', filters.bankId)
      if (filters.cardId && filters.cardId !== "all") params.append('cardId', filters.cardId)
      if (filters.movementType && filters.movementType !== "all") params.append('type', filters.movementType)
      if (filters.fromLocationId && filters.fromLocationId !== "all") params.append('fromLocationId', filters.fromLocationId)
      if (filters.toLocationId && filters.toLocationId !== "all") params.append('toLocationId', filters.toLocationId)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)
      if (filters.searchTerm) params.append('searchTerm', filters.searchTerm)
      params.append('limit', '10000')
      params.append('page', '1')

      const reponse = await authenticatedFetch(`/api/movements?${params.toString()}`)
      const donnees = await reponse.json()
      const mouvements: Movement[] = donnees.success && donnees.data && Array.isArray(donnees.data.movements)
        ? donnees.data.movements
        : []

      const printWindow = window.open("", "_blank")
      if (!printWindow) return

      const formatPeriod = () => {
        const debut = filters.dateFrom
          ? new Date(filters.dateFrom).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' })
          : null
        const fin = filters.dateTo
          ? new Date(filters.dateTo).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' })
          : null
        if (debut && fin) return `Du ${debut} au ${fin}`
        if (debut) return `À partir du ${debut}`
        if (fin) return `Jusqu'au ${fin}`
        return "Ensemble de la période"
      }

      const banqueDeLaCarte = (cardId: string) => {
        const carte = cards.find(c => c.id === cardId)
        return carte ? getBankName(carte.bankId) : "N/A"
      }

      // --- Détail des mouvements ---
      const lignesDetail = mouvements.slice().reverse().map((mouvement) => {
        const carte = cards.find(c => c.id === mouvement.cardId)
        const banque = carte ? banks.find(b => b.id === carte.bankId) : undefined
        const vers = mouvement.movementType === 'exit'
          ? (banque ? `${banque.name}${banque.address ? ` - ${banque.address}` : ''}` : '-')
          : (mouvement.toLocationId ? getLocationName(mouvement.toLocationId) : '-')
        return `<tr>
          <td>${mouvement.reference || '—'}</td>
          <td>${formatDateTime(mouvement.createdAt)}</td>
          <td>${getCardName(mouvement.cardId)}</td>
          <td>${getMovementTypeLabel(mouvement.movementType)}</td>
          <td>${mouvement.fromLocationId ? getLocationName(mouvement.fromLocationId) : '-'}</td>
          <td>${vers}</td>
          <td class="num">${mouvement.quantity}</td>
          <td>${mouvement.reason}</td>
          <td>${getUserName(mouvement.userId)}</td>
        </tr>`
      }).join('')

      // --- Quantités par banque, carte et type de mouvement ---
      const TYPES: Array<"entry" | "exit" | "transfer"> = ["entry", "exit", "transfer"]
      const parBanqueEtCarte = new Map<string, Map<string, Record<string, number>>>()
      for (const mouvement of mouvements) {
        const banque = banqueDeLaCarte(mouvement.cardId)
        const carte = getCardName(mouvement.cardId)
        if (!parBanqueEtCarte.has(banque)) parBanqueEtCarte.set(banque, new Map())
        const cartes = parBanqueEtCarte.get(banque)!
        if (!cartes.has(carte)) cartes.set(carte, { entry: 0, exit: 0, transfer: 0 })
        cartes.get(carte)![mouvement.movementType] += mouvement.quantity
      }

      const totauxGeneraux: Record<string, number> = { entry: 0, exit: 0, transfer: 0 }
      const lignesQuantites = Array.from(parBanqueEtCarte.entries()).map(([banque, cartes]) => {
        const sousTotal: Record<string, number> = { entry: 0, exit: 0, transfer: 0 }
        const lignes = Array.from(cartes.entries()).map(([carte, quantites], index) => {
          for (const type of TYPES) {
            sousTotal[type] += quantites[type]
            totauxGeneraux[type] += quantites[type]
          }
          const total = TYPES.reduce((somme, type) => somme + quantites[type], 0)
          const celluleBanque = index === 0
            ? `<td rowspan="${cartes.size}">${banque}</td>`
            : ''
          return `<tr>${celluleBanque}<td>${carte}</td>${
            TYPES.map((type) => `<td class="num">${quantites[type]}</td>`).join('')
          }<td class="num"><strong>${total}</strong></td></tr>`
        }).join('')
        const totalBanque = TYPES.reduce((somme, type) => somme + sousTotal[type], 0)
        return lignes + `<tr class="sous-total"><td colspan="2">Sous-total ${banque}</td>${
          TYPES.map((type) => `<td class="num">${sousTotal[type]}</td>`).join('')
        }<td class="num">${totalBanque}</td></tr>`
      }).join('')

      const totalGeneral = TYPES.reduce((somme, type) => somme + totauxGeneraux[type], 0)

      // --- Stock restant, par banque, carte et emplacement ---
      // Photographie de l'instant : la base ne conserve pas d'historique de
      // stock, la période filtrée ne s'y applique donc pas. Le titre le dit.
      // Périmètre : les filtres du document ; à défaut, toutes les banques.
      const banquesRetenues = filters.bankId && filters.bankId !== "all"
        ? banks.filter(b => b.id === filters.bankId)
        : banks
      const cartesRetenues = cards.filter((carte) =>
        banquesRetenues.some(b => b.id === carte.bankId) &&
        (!filters.cardId || filters.cardId === "all" || carte.id === filters.cardId))

      let totalStock = 0
      const lignesStock = banquesRetenues.map((banque) => {
        const cartesBanque = cartesRetenues
          .filter(c => c.bankId === banque.id)
          .map((carte) => ({
            carte,
            niveaux: ((carte as any).stockLevels || [])
              .filter((n: any) => (n.quantity ?? 0) > 0)
              .map((n: any) => ({
                emplacement: getLocationName(n.locationId || n.location?.id),
                quantite: n.quantity as number,
              })),
          }))
          .filter((entree) => entree.niveaux.length > 0)

        if (cartesBanque.length === 0) return ''

        const nbLignes = cartesBanque.reduce((somme, e) => somme + e.niveaux.length, 0)
        let sousTotal = 0
        let premiereLigneBanque = true
        const lignes = cartesBanque.map((entree) => entree.niveaux.map((niveau: any, index: number) => {
          sousTotal += niveau.quantite
          const celluleBanque = premiereLigneBanque
            ? `<td rowspan="${nbLignes}">${banque.name}</td>`
            : ''
          premiereLigneBanque = false
          const celluleCarte = index === 0
            ? `<td rowspan="${entree.niveaux.length}">${entree.carte.name}</td>`
            : ''
          return `<tr>${celluleBanque}${celluleCarte}<td>${niveau.emplacement}</td><td class="num">${niveau.quantite}</td></tr>`
        }).join('')).join('')

        totalStock += sousTotal
        return lignes + `<tr class="sous-total"><td colspan="3">Sous-total ${banque.name}</td><td class="num">${sousTotal}</td></tr>`
      }).join('')

      const blocs = `
        ${enteteHtml(logoPath)}
        <div class="titre-document"><h2>Bordereau de Mouvements de Stock</h2></div>
        <div class="info-gauche">
          <p>Généré le ${formatDateTime(new Date())} par ${currentUser.firstName} ${currentUser.lastName}</p>
          <p><strong>Période :</strong> ${formatPeriod()}</p>
          <p><strong>Total :</strong> ${mouvements.length} mouvement${mouvements.length > 1 ? 's' : ''}</p>
        </div>
        <section>
          <h3 class="section">Détails des mouvements</h3>
          <table>
            <thead><tr>
              <th>Numéro</th><th>Date et Heure</th><th>Carte</th><th>Type</th><th>De</th>
              <th>Vers / Adresse</th><th class="num">Quantité</th><th>Motif</th><th>Mouvement effectué par</th>
            </tr></thead>
            <tbody>${lignesDetail || '<tr><td colspan="9">Aucun mouvement</td></tr>'}</tbody>
          </table>
        </section>
        <section>
          <h3 class="section">Quantité des mouvements par banque, carte et type</h3>
          <table>
            <thead><tr>
              <th>Banque</th><th>Carte</th><th class="num">Entrée</th><th class="num">Sortie</th>
              <th class="num">Transfert</th><th class="num">Total</th>
            </tr></thead>
            <tbody>
              ${lignesQuantites || '<tr><td colspan="6">Aucun mouvement</td></tr>'}
              <tr class="ligne-total"><td colspan="2">Total</td>${
                TYPES.map((type) => `<td class="num">${totauxGeneraux[type]}</td>`).join('')
              }<td class="num">${totalGeneral}</td></tr>
            </tbody>
          </table>
        </section>
        <section>
          <h3 class="section">Stock restant au ${formatDateTime(new Date())}</h3>
          <table>
            <thead><tr>
              <th>Banque</th><th>Carte</th><th>Emplacement</th><th class="num">Quantité restante</th>
            </tr></thead>
            <tbody>
              ${lignesStock || '<tr><td colspan="4">Aucun stock</td></tr>'}
              <tr class="ligne-total"><td colspan="3">Total du stock restant</td><td class="num">${totalStock}</td></tr>
            </tbody>
          </table>
        </section>
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

      printWindow.document.write(
        documentImprimable({ titreOnglet: "Bordereau de Mouvements de Stock", blocs }),
      )
      printWindow.document.close()
    } catch (error) {
      console.error('Error loading movements for print:', error)
      toast({
        title: "Impression impossible",
        description: "Les mouvements n'ont pas pu être chargés pour l'impression.",
        variant: "destructive",
      })
    }
  }

  // Récupère TOUS les mouvements correspondant aux filtres actuels (sans pagination),
  // pour l'export CSV/Excel — mêmes filtres que ceux utilisés pour l'impression.
  const fetchAllFilteredMovements = async (): Promise<Movement[]> => {
    const params = new URLSearchParams()
    if (filters.bankId && filters.bankId !== "all") params.append('bankId', filters.bankId)
    if (filters.cardId && filters.cardId !== "all") params.append('cardId', filters.cardId)
    if (filters.movementType && filters.movementType !== "all") params.append('type', filters.movementType)
    if (filters.fromLocationId && filters.fromLocationId !== "all") params.append('fromLocationId', filters.fromLocationId)
    if (filters.toLocationId && filters.toLocationId !== "all") params.append('toLocationId', filters.toLocationId)
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.append('dateTo', filters.dateTo)
    if (filters.searchTerm) params.append('searchTerm', filters.searchTerm)
    params.append('limit', '10000')
    params.append('page', '1')

    const response = await authenticatedFetch(`/api/movements?${params.toString()}`)
    const data = await response.json()
    return data.success && Array.isArray(data.data?.movements) ? data.data.movements : []
  }

  const buildMovementsExportTable = (movementsToExport: Movement[]) => {
    const headers = ["Date et Heure", "Banque", "Carte", "Type", "De", "Vers", "Quantité", "Motif", "Document", "Utilisateur"]
    const rows = movementsToExport.map((movement) => {
      const card = cards.find((c) => c.id === movement.cardId)
      return [
        formatDateTime(movement.createdAt),
        card ? getBankName(card.bankId) : "N/A",
        getCardName(movement.cardId),
        getMovementTypeLabel(movement.movementType),
        movement.fromLocationId ? getLocationName(movement.fromLocationId) : "-",
        movement.toLocationId ? getLocationName(movement.toLocationId) : "-",
        movement.quantity,
        movement.reason,
        movement.documentUrl ? "Oui" : "Non",
        getUserName(movement.userId),
      ]
    })
    return { headers, rows }
  }

  const handleExportMovements = async (format: "csv" | "excel") => {
    try {
      const movementsToExport = await fetchAllFilteredMovements()
      if (movementsToExport.length === 0) {
        toast({ title: "Aucune donnée à exporter", description: "Aucun mouvement ne correspond aux filtres actuels.", variant: "destructive" })
        return
      }

      const { headers, rows } = buildMovementsExportTable(movementsToExport)
      const filename = `mouvements_${new Date().toISOString().slice(0, 10)}`

      if (format === "csv") {
        exportToCsv(filename, headers, rows)
      } else {
        await exportToExcel(filename, [{ name: "Mouvements", headers, rows }])
      }
      toast({
        title: "Export réussi",
        description: `${movementsToExport.length} mouvement(s) exporté(s).`,
        variant: "success",
      })
    } catch (error) {
      console.error('Error exporting movements:', error)
      toast({
        title: "Export impossible",
        description: "Une erreur est survenue pendant l'export des mouvements.",
        variant: "destructive",
      })
    }
  }

  // Bordereau d'un mouvement. Le numéro n'est imprimé que si le mouvement en
  // porte un : ceux enregistrés avant sa mise en place n'en ont pas, et une
  // ligne « Numéro : » vide ferait croire à une anomalie.
  const printSingleMovement = (movement: Movement) => {
    if (!currentUser) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const generePar = `${currentUser.firstName} ${currentUser.lastName}`
    const effectuePar = getUserName(movement.userId)

    const blocs = `
      ${enteteHtml(logoPath)}
      <div class="titre-document"><h2>Bordereau de Mouvement de Stock</h2></div>
      <div class="info-gauche">
        ${movement.reference ? `<p class="numero">Numéro : <strong>${movement.reference}</strong></p>` : ""}
        <p>Généré le ${formatDateTime(new Date())} par ${generePar}</p>
        <p>Mouvement effectué par : ${effectuePar}</p>
      </div>
      <section>
        <h3 class="section">Détails du Mouvement</h3>
        <table><tbody>
          <tr><td class="libelle">Date et Heure :</td><td class="valeur">${formatDateTime(movement.createdAt)}</td></tr>
          <tr><td class="libelle">Carte :</td><td class="valeur">${getCardName(movement.cardId)}</td></tr>
          <tr><td class="libelle">Type de mouvement :</td><td class="valeur">${getMovementTypeLabel(movement.movementType)}</td></tr>
          <tr><td class="libelle">Emplacement source :</td><td class="valeur">${movement.fromLocationId ? getLocationName(movement.fromLocationId) : "-"}</td></tr>
          <tr><td class="libelle">Emplacement destination :</td><td class="valeur">${movement.toLocationId ? getLocationName(movement.toLocationId) : "-"}</td></tr>
          <tr><td class="libelle">Quantité :</td><td class="valeur">${movement.quantity}</td></tr>
          <tr><td class="libelle">Motif :</td><td class="valeur">${movement.reason}</td></tr>
        </tbody></table>
      </section>
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
        <div class="signature"><p>Signature :</p></div>
      </div>`

    printWindow.document.write(
      documentImprimable({ titreOnglet: "Bordereau de Mouvement de Stock", blocs }),
    )
    printWindow.document.close()
  }

  // Supprime un mouvement après confirmation explicite. Le serveur annule
  // l'effet du mouvement sur le stock ; il refuse (409) si cette annulation
  // rendait le stock négatif, auquel cas on remonte son message tel quel.
  const handleConfirmDelete = async () => {
    if (!movementToDelete) return

    setIsDeleting(true)
    try {
      const response = await authenticatedFetch(`/api/movements/${movementToDelete.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!data.success) {
        toast({
          title: "Suppression impossible",
          description: data.error || "Erreur inconnue",
          variant: "destructive",
        })
        return
      }

      setMovementToDelete(null)
      await loadMovements()
      // Recharge les stocks par emplacement, mis à jour par l'annulation.
      await loadCardsLocationsBanks()
      toast({
        title: "Mouvement supprimé",
        description: "Le stock a été réajusté en conséquence.",
        variant: "success",
      })
    } catch (error) {
      console.error('Error deleting movement:', error)
      toast({
        title: "Suppression impossible",
        description: "Une erreur est survenue pendant la suppression du mouvement.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getAvailableStock = (cardId: string, locationId: string): number => {
    if (!cardId || !locationId) return 0
    const card: any = cards.find((c: any) => c.id === cardId)
    if (!card) return 0

    // Source de vérité: stockLevels (quantité par emplacement) fournis par l'API
    const level = (card.stockLevels || []).find((sl: any) => sl.locationId === locationId || sl.location?.id === locationId)
    if (level) return Number(level.quantity) || 0

    // Fallback (ancien calcul): dériver des mouvements si stockLevels absent
    // S'assurer que movements est un tableau avant d'utiliser filter
    const cardMovements = Array.isArray(movements) ? movements.filter((m) => m.cardId === cardId) : []
    let stock = 0
    for (const movement of cardMovements) {
      if (movement.toLocationId === locationId) stock += movement.quantity
      if (movement.fromLocationId === locationId) stock -= movement.quantity
    }
    return stock
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) return

    const errors: {
      quantity?: string
      fromLocationId?: string
      toLocationId?: string
      reason?: string
    } = {}

    // Validate bankId
    if (!formData.bankId) {
      showValidationErrorsToast({ bankId: "Veuillez sélectionner une banque" })
      return
    }

    // Validation des quantités par carte (déjà fait dans la boucle ci-dessus)

    // Validate cards belong to selected bank
    if (formData.cardQuantities.length === 0) {
      showValidationErrorsToast({ cardQuantities: "Veuillez sélectionner au moins une carte" })
      return
    }

    for (const cardQuantity of formData.cardQuantities) {
      const card = cards.find(c => c.id === cardQuantity.cardId)
      if (card && card.bankId !== formData.bankId) {
        showValidationErrorsToast({ cardQuantities: "Une des cartes sélectionnées n'appartient pas à la banque choisie" })
        return
      }
      if (cardQuantity.quantity <= 0) {
        showValidationErrorsToast({ cardQuantities: `La quantité pour la carte ${card?.name} doit être supérieure à 0` })
        return
      }
    }

    // Valider la présence des emplacements requis selon le type de mouvement
    // (le serveur les exige aussi ; sans ce contrôle côté client, la requête
    // partait avec un champ vide et échouait en 400 sans message clair dans le formulaire).
    if ((formData.movementType === "entry" || formData.movementType === "transfer") && !formData.toLocationId) {
      errors.toLocationId = "L'emplacement destination est obligatoire"
    }
    if ((formData.movementType === "exit" || formData.movementType === "transfer") && !formData.fromLocationId) {
      errors.fromLocationId = "L'emplacement source est obligatoire"
    }

    // Validate locations belong to selected bank
    if (formData.fromLocationId) {
      const fromLocation = locations.find(l => l.id === formData.fromLocationId)
      if (fromLocation && fromLocation.bankId !== formData.bankId) {
        errors.fromLocationId = "L'emplacement source n'appartient pas à la banque choisie"
      }
    }

    if (formData.toLocationId) {
      const toLocation = locations.find(l => l.id === formData.toLocationId)
      if (toLocation && toLocation.bankId !== formData.bankId) {
        errors.toLocationId = "L'emplacement destination n'appartient pas à la banque choisie"
      }
    }

    // Validate transfer to same location
    if (formData.movementType === "transfer") {
      if (formData.fromLocationId === formData.toLocationId) {
        errors.fromLocationId = "L'emplacement source et destination doivent être différents"
        errors.toLocationId = "L'emplacement source et destination doivent être différents"
      }
    }

    // Validate reason (motif) is required
    const selectedReason = movementReasons.find((r) => r.id === selectedReasonId)
    if (!selectedReason) {
      errors.reason = "Veuillez sélectionner un motif"
    } else if (selectedReason.isOther && (!formData.reason || formData.reason.trim() === "")) {
      errors.reason = "Veuillez préciser le motif"
    }

    // Validate available stock for exit and transfer
    if (formData.movementType === "exit" || formData.movementType === "transfer") {
      if (formData.fromLocationId && formData.cardQuantities.length > 0) {
        // Vérifier le stock pour chaque carte sélectionnée
        const insufficientCards = []
        
        for (const cardQuantity of formData.cardQuantities) {
          const availableStock = getAvailableStock(cardQuantity.cardId, formData.fromLocationId)
          if (cardQuantity.quantity > availableStock) {
            const card = cards.find(c => c.id === cardQuantity.cardId)
            insufficientCards.push({
              cardName: card?.name || 'Carte inconnue',
              available: availableStock,
              requested: cardQuantity.quantity,
              missing: cardQuantity.quantity - availableStock
            })
          }
        }
        
        if (insufficientCards.length > 0) {
          toast({
            title: "Erreurs de validation",
            description: (
              <ul className="list-disc space-y-0.5 pl-4">
                {insufficientCards.map((card) => (
                  <li key={card.cardName}>
                    <strong>{card.cardName} :</strong> {card.available} disponible (demandé : {card.requested}, manque : {card.missing})
                  </li>
                ))}
              </ul>
            ),
            variant: "destructive",
          })
          return
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      showValidationErrorsToast(errors)
      return
    }

    setFormErrors({})

    // Créer un mouvement pour chaque carte avec sa quantité
    try {
      // Snapshot des infos pour l'impression consolidée avant reset
      const bulkContext = {
        bankId: formData.bankId,
        fromLocationId: formData.fromLocationId,
        toLocationId: formData.toLocationId,
        movementType: formData.movementType,
        reason: formData.reason,
        cardQuantities: [...formData.cardQuantities],
      }
      let successCount = 0
      let errorCount = 0
      const createdMovements: Movement[] = [] as any
      const errors: Array<{ cardName: string; error: string }> = []

      // Réinitialiser les erreurs avant de commencer
      setMovementErrors([])

      // Téléverser le document justificatif une seule fois (le cas échéant) et
      // l'associer à chaque mouvement créé dans ce lot.
      let uploadedDocument: { url: string; name: string } | null = null
      if (formData.movementType === "entry" && documentFile) {
        const uploadBody = new FormData()
        uploadBody.append("file", documentFile)

        // authenticatedFetch détecte le corps FormData et n'impose pas
        // Content-Type: application/json dans ce cas (le navigateur fixe
        // lui-même le Content-Type avec sa boundary multipart).
        const uploadResponse = await authenticatedFetch('/api/movements/upload', {
          method: 'POST',
          body: uploadBody,
        })
        const uploadResult = await uploadResponse.json()
        if (!uploadResult.success) {
          toast({
            title: "Échec du téléversement",
            description: uploadResult.error || "Erreur inconnue",
            variant: "destructive",
          })
          return
        }
        uploadedDocument = uploadResult.data
      }

      for (const cardQuantity of formData.cardQuantities) {
        const movementData = {
          ...formData,
          cardId: cardQuantity.cardId,
          quantity: cardQuantity.quantity, // Quantité spécifique à cette carte
          // userId sera récupéré depuis l'en-tête x-user-data
          fromLocationId: formData.movementType === "entry" ? null : formData.fromLocationId || null,
          toLocationId: formData.movementType === "exit" ? null : formData.toLocationId || null,
          ...(uploadedDocument
            ? { documentUrl: uploadedDocument.url, documentName: uploadedDocument.name }
            : {}),
        }

        const response = await authenticatedFetch('/api/movements', {
          method: 'POST',
          body: JSON.stringify(movementData)
        })

        const data = await response.json()
        if (data.success) {
          successCount++
          createdMovements.push(data.data)
        } else {
          errorCount++
          const card = cards.find(c => c.id === cardQuantity.cardId)
          const cardName = card?.name || "Carte inconnue"
          const errorMessage = data.error || "Erreur inconnue"
          errors.push({ cardName, error: errorMessage })
          console.error(`Erreur pour la carte ${cardName}:`, errorMessage)
        }
      }

      // Afficher les erreurs dans le modal
      if (errors.length > 0) {
        setMovementErrors(errors)
      }

      await loadMovements()
      // Recharger les cartes (et leurs stockLevels par emplacement) : sans cela, le stock
      // disponible affiché/validé pour un mouvement suivant reste celui d'avant ce mouvement
      // tant que la page n'est pas rechargée manuellement.
      await loadCardsLocationsBanks()

      // Impression d'un bon consolidé si plusieurs cartes (génération en masse) et que tous sont réussis
      if (bulkContext.cardQuantities.length > 1 && successCount > 0 && errorCount === 0) {
        printBulkSlip(bulkContext, createdMovements)
      }

      // Ne fermer le modal que si toutes les opérations ont réussi
      if (errorCount === 0) {
        resetForm()
        setIsDialogOpen(false)
        if (successCount > 0) {
          toast({
            title: "Mouvement créé",
            description: `${successCount} mouvement(s) créé(s) avec succès.`,
            variant: "success",
          })
        }
      } else {
        // Garder le modal ouvert pour afficher les erreurs
        // Afficher un message récapitulatif
        if (successCount > 0) {
          toast({
            title: "Création partiellement réussie",
            description: `${successCount} mouvement(s) créé(s), ${errorCount} erreur(s). Voir le détail ci-dessous.`,
            variant: "destructive",
          })
        } else {
          toast({
            title: "Échec de la création",
            description: `${errorCount} erreur(s) lors de la création. Voir le détail ci-dessous.`,
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error('Error creating movements:', error)
      toast({
        title: "Création impossible",
        description: "Une erreur est survenue pendant la création des mouvements.",
        variant: "destructive",
      })
    }
  }

  // Impression d'un bon consolidé pour la génération en masse
  // Bordereau consolidé d'une génération en masse. Chaque carte donne lieu à un
  // mouvement distinct, donc à un numéro distinct : ils figurent en regard de
  // chaque ligne plutôt qu'en tête de document.
  const printBulkSlip = (
    ctx: {
      bankId: string
      fromLocationId: string
      toLocationId: string
      movementType: "entry" | "exit" | "transfer"
      reason: string
      cardQuantities: { cardId: string; quantity: number }[]
    },
    created: Movement[]
  ) => {
    if (!currentUser) return
    const w = window.open("", "_blank")
    if (!w) return

    const bank = banks.find(b => b.id === ctx.bankId)
    // Champ "De" :
    // - pour une SORTIE, l'adresse fixe de la SMT ;
    // - sinon, le nom et l'adresse de l'emplacement source si disponibles.
    let fromName = '-'
    if (ctx.movementType === 'exit') {
      fromName = `SMT - ${ADRESSE_SOCIETE} - Tunisie`
    } else if (ctx.movementType !== 'entry' && ctx.fromLocationId) {
      const fromLoc = locations.find(l => l.id === ctx.fromLocationId) as any
      const fromAddress = fromLoc?.address ? ` - ${fromLoc.address}` : ''
      fromName = fromLoc ? `${fromLoc.name}${fromAddress}` : getLocationName(ctx.fromLocationId)
    }
    const toName = ctx.movementType !== 'exit' && ctx.toLocationId ? getLocationName(ctx.toLocationId) : '-'
    const bankAddress = bank?.address || ''
    const destinationInfo = ctx.movementType === 'exit'
      ? (bankAddress ? `${bank?.name || ''}<br/>${bankAddress}` : (bank?.name || '-'))
      : toName

    // Le mouvement créé pour une carte porte la référence à imprimer sur sa ligne.
    const referencePourCarte = (cardId: string) =>
      created.find((m) => m.cardId === cardId)?.reference || "—"

    const totalQty = ctx.cardQuantities.reduce((somme, cq) => somme + cq.quantity, 0)
    const lignes = ctx.cardQuantities.map(cq => {
      const carte = cards.find(c => c.id === cq.cardId)
      return `<tr>
        <td>${referencePourCarte(cq.cardId)}</td>
        <td>${carte?.name || getCardName(cq.cardId)}</td>
        <td>${carte?.type || '-'}</td>
        <td>${carte?.subType || '-'}</td>
        <td>${carte?.subSubType || '-'}</td>
        <td class="num">${cq.quantity}</td>
      </tr>`
    }).join('')

    const signatures = ctx.movementType === 'exit' ? `
      <section>
        <table><tbody><tr>
          <td style="width:50%">
            <p style="font-weight:bold; margin:0 0 8px">Expéditeur</p>
            <p style="margin:0 0 4px; color:#6b7280">Nom &amp; Prénom :</p>
            <div class="trait"></div>
            <p style="margin:10px 0 4px; color:#6b7280">Signature et Cachet :</p>
            <div style="height:46px; border:1px dashed #9ca3af"></div>
          </td>
          <td style="width:50%">
            <p style="font-weight:bold; margin:0 0 8px">Destinataire</p>
            <p style="margin:0 0 4px; color:#6b7280">Nom &amp; Prénom :</p>
            <div class="trait"></div>
            <p style="margin:10px 0 4px; color:#6b7280">Signature et Cachet :</p>
            <div style="height:46px; border:1px dashed #9ca3af"></div>
          </td>
        </tr></tbody></table>
      </section>` : ''

    const blocs = `
      ${enteteHtml(logoPath)}
      <div class="titre-document"><h2>Bordereau de Mouvement de Stock (Consolidé)</h2></div>
      <div class="info-gauche">
        <p>Généré le ${formatDateTime(new Date())} par ${currentUser.firstName} ${currentUser.lastName}</p>
        <p>Mouvement effectué par : ${currentUser.firstName} ${currentUser.lastName}</p>
      </div>
      <section>
        <h3 class="section">Détails du Mouvement</h3>
        <table><tbody>
          <tr><td class="libelle">Banque :</td><td class="valeur">${bank?.name || '-'}</td></tr>
          <tr><td class="libelle">Type :</td><td class="valeur">${getMovementTypeLabel(ctx.movementType)}</td></tr>
          <tr><td class="libelle">Motif :</td><td class="valeur">${ctx.reason || '-'}</td></tr>
          <tr><td class="libelle">De :</td><td class="valeur">${fromName}</td></tr>
          <tr><td class="libelle">Vers / Adresse :</td><td class="valeur">${destinationInfo}</td></tr>
          <tr><td class="libelle">Total des cartes :</td><td class="valeur">${totalQty}</td></tr>
        </tbody></table>
      </section>
      <section>
        <h3 class="section">Détails des cartes</h3>
        <table>
          <thead><tr>
            <th>Numéro</th><th>Nom de la carte</th><th>Type</th>
            <th>Sous-type</th><th>Sous-sous-type</th><th class="num">Quantité</th>
          </tr></thead>
          <tbody>
            ${lignes}
            <tr class="ligne-total"><td colspan="5">Total des cartes dans le bon</td><td class="num">${totalQty}</td></tr>
          </tbody>
        </table>
      </section>
      ${signatures}`

    w.document.write(
      documentImprimable({ titreOnglet: "Bordereau de Mouvement de Stock (Consolidé)", blocs }),
    )
    w.document.close()
  }

  const resetForm = () => {
    setFormData({
      bankId: "",
      cardQuantities: [], // Quantités par carte
      fromLocationId: "",
      toLocationId: "",
      movementType: "entry",
      reason: "",
    })
    setSelectedReasonId("")
    setDocumentFile(null)
    setFormErrors({})
    setMovementErrors([]) // Réinitialiser les erreurs de mouvement
  }

  // Motif à pré-sélectionner pour un type de mouvement, tel que configuré dans
  // Configuration > Motifs. L'objectif est que l'utilisateur n'ait pas à choisir
  // le motif : il est coché d'office, et reste modifiable.
  const motifParDefaut = useCallback(
    (type: "entry" | "exit" | "transfer") =>
      movementReasons.find((motif) => motif.movementType === type) ?? null,
    [movementReasons],
  )

  // Applique le motif configuré pour un type. Coche réellement la case : c'est
  // ce que l'ancien pré-remplissage codé en dur oubliait de faire, si bien que
  // la validation réclamait quand même un motif.
  const appliquerMotifParDefaut = useCallback(
    (type: "entry" | "exit" | "transfer") => {
      const motif = motifParDefaut(type)
      setSelectedReasonId(motif?.id ?? "")
      setFormData((prev) => ({ ...prev, reason: motif?.label ?? "" }))
      setFormErrors((prev) => (prev.reason ? { ...prev, reason: undefined } : prev))
    },
    [motifParDefaut],
  )

  // À l'ouverture du formulaire, les motifs peuvent ne pas être encore chargés :
  // on pré-sélectionne dès qu'ils arrivent. La condition sur selectedReasonId
  // garantit qu'un choix déjà fait par l'utilisateur n'est jamais écrasé.
  useEffect(() => {
    if (!isDialogOpen || selectedReasonId || movementReasons.length === 0) return
    appliquerMotifParDefaut(formData.movementType)
  }, [isDialogOpen, selectedReasonId, movementReasons, formData.movementType, appliquerMotifParDefaut])

  // Sélection du motif : à choix unique (cocher un motif décoche les autres).
  // Si le motif "Autre" est choisi, le champ texte devient la source du motif.
  const handleReasonSelect = (reasonId: string) => {
    const reason = movementReasons.find((r) => r.id === reasonId)
    if (!reason) return

    setSelectedReasonId(reasonId)
    setFormData((prev) => ({ ...prev, reason: reason.isOther ? "" : reason.label }))
    if (formErrors.reason) {
      setFormErrors({ ...formErrors, reason: undefined })
    }
  }

  // Fonction pour gérer la sélection des cartes avec quantité
  const handleCardSelection = (cardId: string, isSelected: boolean) => {
    setFormData(prev => {
      if (isSelected) {
        // Ajouter la carte avec quantité par défaut de 1
        if (!prev.cardQuantities.find(cq => cq.cardId === cardId)) {
          return { ...prev, cardQuantities: [...prev.cardQuantities, { cardId, quantity: 1 }] }
        }
      } else {
        // Retirer la carte de la sélection
        return { ...prev, cardQuantities: prev.cardQuantities.filter(cq => cq.cardId !== cardId) }
      }
      return prev
    })
  }

  // Fonction pour mettre à jour la quantité d'une carte
  const handleCardQuantityChange = (cardId: string, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      cardQuantities: prev.cardQuantities.map(cq => 
        cq.cardId === cardId ? { ...cq, quantity } : cq
      )
    }))
  }

  // Fonction pour générer en masse les mouvements
  const generateBulkMovements = () => {
    // Vérifier que les prérequis sont remplis
    if (!formData.bankId || !formData.fromLocationId) {
      toast({
        title: "Sélection incomplète",
        description: "Choisissez une banque et un emplacement source « De » avant de générer.",
        variant: "destructive",
      })
      return
    }

    if (formData.movementType !== "exit" && formData.movementType !== "transfer") {
      toast({
        title: "Génération indisponible",
        description: "La génération en masse ne concerne que les mouvements de type Sortie et Transfert.",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingBulk(true)

    try {
      // Parcourir toutes les cartes de la banque sélectionnée
      const filteredCards = getFilteredCards()
      const cardsWithStock: { cardId: string; quantity: number }[] = []
      let totalCardsGenerated = 0

      for (const card of filteredCards) {
        // Vérifier le stock disponible pour cette carte dans l'emplacement source
        const availableStock = getAvailableStock(card.id, formData.fromLocationId)
        
        // Si la carte contient du stock (quantité > 0)
        if (availableStock > 0) {
          // Ajouter la carte avec la totalité du stock disponible
          cardsWithStock.push({
            cardId: card.id,
            quantity: availableStock
          })
          totalCardsGenerated++
        }
      }

      if (cardsWithStock.length === 0) {
        toast({
          title: "Aucune carte à générer",
          description: "Aucune carte de cet emplacement ne dispose de stock disponible.",
          variant: "destructive",
        })
        setIsGeneratingBulk(false)
        return
      }

      // Fusionner avec les cartes déjà sélectionnées (éviter les doublons, mais garder les modifications manuelles)
      const existingCardIds = new Set(formData.cardQuantities.map(cq => cq.cardId))
      const newCards = cardsWithStock.filter(card => !existingCardIds.has(card.cardId))
      const wasEmpty = formData.cardQuantities.length === 0

      setFormData(prev => ({
        ...prev,
        // Garder les cartes déjà sélectionnées et ajouter les nouvelles
        cardQuantities: [...prev.cardQuantities, ...newCards]
      }))

      // Afficher un message de confirmation
      const totalCardsNow = formData.cardQuantities.length + newCards.length
      toast({
        title: `${totalCardsGenerated} carte(s) ${wasEmpty ? 'sélectionnée(s)' : 'ajoutée(s)'}`,
        description: `Chaque carte a été reprise avec la totalité de son stock disponible. Total : ${totalCardsNow} carte(s) sélectionnée(s). Les quantités restent modifiables.`,
        variant: "success",
      })
    } catch (error) {
      console.error('Error generating bulk movements:', error)
      toast({
        title: "Génération impossible",
        description: "Une erreur est survenue pendant la génération en masse des mouvements.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingBulk(false)
    }
  }

  // Filtrer les cartes par banque sélectionnée
  const getFilteredCards = () => {
    if (!formData.bankId) return []
    return cards.filter(card => card.bankId === formData.bankId)
  }

  // Vérifier si le stock est suffisant pour toutes les cartes
  const isStockSufficient = () => {
    if (formData.movementType !== "exit" && formData.movementType !== "transfer") return true
    if (!formData.fromLocationId || formData.cardQuantities.length === 0) return true
    
    return formData.cardQuantities.every(cq => {
      const availableStock = getAvailableStock(cq.cardId, formData.fromLocationId)
      return cq.quantity <= availableStock
    })
  }

  // Filtrer les emplacements par banque sélectionnée
  const getFilteredLocations = () => {
    if (!formData.bankId) return []
    return locations.filter(location => location.bankId === formData.bankId)
  }

  // Obtenir l'adresse de la banque pour les sorties
  const getBankAddress = () => {
    if (!formData.bankId) return ""
    const bank = banks.find(b => b.id === formData.bankId)
    return bank?.address || ""
  }

  const getBankName = (bankId: string) => {
    const bank = banks.find(b => b.id === bankId)
    return bank ? bank.name : "N/A"
  }

  // Le filtrage est maintenant géré côté serveur via l'API

  // Réinitialiser les filtres
  const resetFilters = () => {
    setFilters({
      bankId: "all",
      cardId: "all",
      movementType: "all",
      fromLocationId: "all",
      toLocationId: "all",
      dateFrom: "",
      dateTo: "",
      searchTerm: ""
    })
    setCurrentPage(1) // Réinitialiser à la première page
  }

  // Gérer le changement de page
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll vers le haut du tableau
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Réinitialiser à la page 1 quand les filtres changent
  useEffect(() => {
    setCurrentPage(1)
  }, [filters.bankId, filters.cardId, filters.movementType, filters.fromLocationId, filters.toLocationId, filters.dateFrom, filters.dateTo, filters.searchTerm])

  // Obtenir les cartes filtrées par banque pour le filtre
  const getCardsForFilter = () => {
    if (!filters.bankId || filters.bankId === "all") return cards
    return cards.filter(card => card.bankId === filters.bankId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Gestion des Mouvements</h2>
          <p className="text-xs text-[#008DA8] mt-1">Suivez les mouvements de stock</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Les boutons ont été déplacés dans l'en-tête du tableau ci-dessous */}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) {
                // Réinitialiser les erreurs quand on ferme le modal
                setMovementErrors([])
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} size="default" className="font-medium">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nouveau mouvement
                </Button>
              </DialogTrigger>
              <DialogContent className="w-full sm:max-w-[720px] md:max-w-[840px] max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                  <DialogTitle>Nouveau Mouvement</DialogTitle>
                  <DialogDescription>Enregistrez un nouveau mouvement de stock.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="grid gap-4 py-4 px-6 overflow-y-auto flex-1 min-h-0">
                  {/* 1. Sélection de la banque (OBLIGATOIRE EN PREMIER) */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bank" className="text-right font-semibold">
                      Banque *
                    </Label>
                    <Select
                      value={formData.bankId}
                      onValueChange={(value) => {
                        setFormData({ ...formData, bankId: value, cardQuantities: [], fromLocationId: "", toLocationId: "" })
                      }}
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

                  {/* 2. Type de mouvement */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="movementType" className="text-right font-semibold">
                      Type *
                    </Label>
                    <Select
                      value={formData.movementType}
                      onValueChange={(value: "entry" | "exit" | "transfer") => {
                        setFormData({
                          ...formData,
                          movementType: value,
                          fromLocationId: "",
                          toLocationId: "",
                        })
                        // Le motif configuré pour le nouveau type est appliqué,
                        // y compris s'il n'y en a aucun : la case est alors
                        // décochée, pour que le choix reste explicite.
                        appliquerMotifParDefaut(value)
                      }}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Entrée</SelectItem>
                        <SelectItem value="exit">Sortie</SelectItem>
                        <SelectItem value="transfer">Transfert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 3. Emplacement source (pour Sortie et Transfert) */}
                  {(formData.movementType === "exit" || formData.movementType === "transfer") && (
                    <>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="fromLocation" className="text-right font-semibold">
                          Emplacement (De) *
                        </Label>
                        <div className="col-span-3">
                          <Select
                            value={formData.fromLocationId}
                            onValueChange={(value) => {
                              setFormData({ ...formData, fromLocationId: value, cardQuantities: [] })
                              if (formErrors.fromLocationId) {
                                setFormErrors({ ...formErrors, fromLocationId: undefined })
                              }
                              if (formErrors.quantity) {
                                setFormErrors({ ...formErrors, quantity: undefined })
                              }
                            }}
                            disabled={!formData.bankId}
                          >
                            <SelectTrigger className={cn(formErrors.fromLocationId && "border-destructive ring-1 ring-destructive")}>
                              <SelectValue placeholder={formData.bankId ? "Emplacement source" : "Sélectionnez d'abord une banque"} />
                            </SelectTrigger>
                            <SelectContent>
                              {getFilteredLocations().map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 4. Emplacement destination (pour Entrée et Transfert uniquement) */}
                  {(formData.movementType === "entry" || formData.movementType === "transfer") && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="toLocation" className="text-right font-semibold">
                        Emplacement (Vers) *
                      </Label>
                      <div className="col-span-3">
                        <Select
                          value={formData.toLocationId}
                          onValueChange={(value) => {
                            setFormData({ ...formData, toLocationId: value })
                            if (formErrors.toLocationId) {
                              setFormErrors({ ...formErrors, toLocationId: undefined })
                            }
                          }}
                          disabled={!formData.bankId}
                        >
                          <SelectTrigger className={cn(formErrors.toLocationId && "border-destructive ring-1 ring-destructive")}>
                            <SelectValue placeholder={formData.bankId ? "Emplacement destination" : "Sélectionnez d'abord une banque"} />
                          </SelectTrigger>
                          <SelectContent>
                            {getFilteredLocations().map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* 5. Adresse destination automatique (SORTIE UNIQUEMENT - NON ÉDITABLE) */}
                  {formData.movementType === "exit" && formData.bankId && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right font-semibold">
                        Adresse destination
                      </Label>
                      <div className="col-span-3 p-2 bg-slate-100 rounded text-sm text-slate-700 border">
                        {getBankAddress()}
                      </div>
                    </div>
                  )}

                  {/* 6. Sélection de la carte (filtrée par banque) */}
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right font-semibold pt-2">
                      Cartes *
                    </Label>
                    <div className="col-span-3">
                      {/* L'action qui remplit cette liste a sa place juste au-dessus
                          d'elle, dans la colonne des champs. Auparavant elle était
                          centrée sur toute la largeur, hors de la grille du formulaire. */}
                      {formData.bankId && formData.fromLocationId && (
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={generateBulkMovements}
                            disabled={isGeneratingBulk}
                            className="border-slate-200 bg-slate-100 text-slate-700 transition-colors hover:border-[#0084a8] hover:bg-[#0084a8] hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {isGeneratingBulk ? (
                              <>
                                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Génération en cours...
                              </>
                            ) : (
                              <>
                                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Générer en masse les mouvements
                              </>
                            )}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Sélectionne toutes les cartes en stock à l'emplacement source.
                          </span>
                        </div>
                      )}
                      {!formData.bankId ? (
                        <p className="text-sm text-gray-500">Sélectionnez d'abord une banque</p>
                      ) : getFilteredCards().length === 0 ? (
                        <p className="text-sm text-gray-500">Aucune carte disponible pour cette banque</p>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto border rounded-md p-3">
                          {getFilteredCards().map((card) => {
                            const cardQuantity = formData.cardQuantities.find(cq => cq.cardId === card.id)
                            const isSelected = !!cardQuantity
                            
                            return (
                              <div key={card.id} className="border rounded-md p-3 bg-gray-50">
                                <div className="flex items-center space-x-2 mb-2">
                                  <input
                                    type="checkbox"
                                    id={`card-${card.id}`}
                                    checked={isSelected}
                                    onChange={(e) => handleCardSelection(card.id, e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <label htmlFor={`card-${card.id}`} className="text-sm font-medium cursor-pointer">
                                    {card.name} ({card.type} - {card.subType})
                                  </label>
                                </div>
                                
                                {isSelected && (
                                  <div className="ml-6">
                                    <label htmlFor={`quantity-${card.id}`} className="text-xs text-gray-600">
                                      Quantité pour cette carte:
                                    </label>
                                    <input
                                      type="number"
                                      id={`quantity-${card.id}`}
                                      min="1"
                                      value={cardQuantity?.quantity || 1}
                                      onChange={(e) => handleCardQuantityChange(card.id, Number.parseInt(e.target.value) || 1)}
                                      className="w-20 ml-2 px-2 py-1 text-sm border rounded"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {formData.cardQuantities.length > 0 && (
                        <div className="text-sm text-green-600 mt-2">
                          <p>{formData.cardQuantities.length} carte(s) sélectionnée(s):</p>
                          {formData.cardQuantities.map(cq => {
                            const card = cards.find(c => c.id === cq.cardId)
                            return (
                              <p key={cq.cardId} className="ml-2 text-xs">
                                • {card?.name}: {cq.quantity}
                              </p>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 7. Résumé des quantités */}
                  {formData.cardQuantities.length > 0 && (
                    <div className="grid grid-cols-4 items-start gap-4">
                      <Label className="text-right font-semibold pt-2">
                        Résumé
                      </Label>
                      <div className="col-span-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                          <p className="text-sm font-medium text-blue-800 mb-2">Quantités sélectionnées:</p>
                          {formData.cardQuantities.map(cq => {
                            const card = cards.find(c => c.id === cq.cardId)
                            return (
                              <div key={cq.cardId} className="flex justify-between items-center text-sm">
                                <span>{card?.name}</span>
                                <span className="font-medium">{cq.quantity}</span>
                              </div>
                            )
                          })}
                          <div className="border-t border-blue-200 mt-2 pt-2">
                            <div className="flex justify-between items-center text-sm font-medium">
                              <span>Total:</span>
                              <span>{formData.cardQuantities.reduce((sum, cq) => sum + cq.quantity, 0)}</span>
                            </div>
                          </div>
                        </div>
                        
                        {formData.fromLocationId &&
                          (formData.movementType === "exit" || formData.movementType === "transfer") && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-red-700 mb-2">Stock disponible par carte:</p>
                              {formData.cardQuantities.map(cq => {
                                const card = cards.find(c => c.id === cq.cardId)
                                const stock = getAvailableStock(cq.cardId, formData.fromLocationId)
                                const isInsufficient = cq.quantity > stock
                                
                                return (
                                  <div key={cq.cardId} className={`ml-2 p-2 rounded-md mb-1 ${
                                    isInsufficient 
                                      ? 'bg-red-50 border border-red-200' 
                                      : 'bg-green-50 border border-green-200'
                                  }`}>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium">{card?.name}</span>
                                      <div className="text-sm">
                                        <span className={isInsufficient ? 'text-red-600' : 'text-green-600'}>
                                          {stock} disponible
                                        </span>
                                        <span className="text-gray-500 ml-2">
                                          (demandé: {cq.quantity})
                                        </span>
                                      </div>
                                    </div>
                                    {isInsufficient && (
                                      <p className="text-xs text-red-600 mt-1">
                                        ⚠️ Quantité insuffisante (manque {cq.quantity - stock})
                                      </p>
                                    )}
                                  </div>
                                )
                              })}
                              
                              {/* Message global si une ou plusieurs cartes ont un stock insuffisant */}
                              {formData.cardQuantities.some(cq => {
                                const stock = getAvailableStock(cq.cardId, formData.fromLocationId)
                                return cq.quantity > stock
                              }) && (
                                <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-md">
                                  <div className="flex items-center">
                                    <span className="text-red-600 mr-2">⚠️</span>
                                    <p className="text-sm text-red-800 font-medium">
                                      Le mouvement ne peut pas être effectué à cause de quantités insuffisantes
                                    </p>
                                  </div>
                                  <p className="text-xs text-red-600 mt-1">
                                    Veuillez ajuster les quantités ou choisir un autre emplacement source
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* 8. Motif */}
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right mt-2 font-semibold">
                      Motif *
                    </Label>
                    <div
                      className={cn(
                        "col-span-3 space-y-2 rounded-md p-2",
                        formErrors.reason && "ring-1 ring-destructive",
                      )}
                    >
                      {movementReasons.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Chargement des motifs...</p>
                      ) : (
                        movementReasons.map((movementReason) => (
                          <div key={movementReason.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`reason-${movementReason.id}`}
                              checked={selectedReasonId === movementReason.id}
                              onChange={() => handleReasonSelect(movementReason.id)}
                              className="rounded border-gray-300"
                            />
                            <label htmlFor={`reason-${movementReason.id}`} className="text-sm cursor-pointer">
                              {movementReason.label}
                            </label>
                          </div>
                        ))
                      )}

                      {movementReasons.find((r) => r.id === selectedReasonId)?.isOther && (
                        <Textarea
                          id="reason"
                          value={formData.reason}
                          onChange={(e) => {
                            setFormData({ ...formData, reason: e.target.value })
                            if (formErrors.reason) {
                              setFormErrors({ ...formErrors, reason: undefined })
                            }
                          }}
                          placeholder="Précisez le motif"
                          className="mt-2"
                        />
                      )}
                    </div>
                  </div>

                  {/* 9. Document justificatif (optionnel, entrées uniquement) */}
                  {formData.movementType === "entry" && (
                    <div className="grid grid-cols-4 items-start gap-4">
                      <Label htmlFor="document" className="text-right mt-2 font-semibold">
                        Document
                      </Label>
                      <div className="col-span-3 space-y-1">
                        <Input
                          id="document"
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Optionnel. PDF ou image, 5 Mo maximum.
                        </p>
                        {documentFile && (
                          <p className="text-xs text-muted-foreground">Fichier sélectionné : {documentFile.name}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Section centralisée pour tous les messages d'erreur */}
                  {(Object.keys(formErrors).length > 0 || movementErrors.length > 0) && (
                    <div className="px-0">
                      <Alert variant="destructive">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <AlertTitle>
                          {movementErrors.length > 0 
                            ? "Erreurs lors de la création des mouvements" 
                            : "Erreurs de validation"}
                        </AlertTitle>
                        <AlertDescription>
                          <div className="mt-2 space-y-2">
                            {/* Erreurs de formulaire (champs obligatoires) */}
                            {formErrors.fromLocationId && (
                              <div className="text-sm">• <strong>Emplacement source:</strong> {formErrors.fromLocationId}</div>
                            )}
                            {formErrors.toLocationId && (
                              <div className="text-sm">• <strong>Emplacement destination:</strong> {formErrors.toLocationId}</div>
                            )}
                            {formErrors.reason && (
                              <div className="text-sm">• <strong>Motif:</strong> {formErrors.reason}</div>
                            )}
                            {formErrors.quantity && (
                              <div className="text-sm">• <strong>Quantité:</strong> {formErrors.quantity}</div>
                            )}
                            {/* Erreurs de mouvement */}
                            {movementErrors.map((err, idx) => (
                              <div key={idx} className="text-sm">
                                • <strong>{err.cardName}</strong> : {err.error}
                              </div>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
                <DialogFooter className="flex-shrink-0 border-t pt-4 px-6 pb-4 bg-white">
                  <Button 
                    type="submit" 
                    disabled={!formData.bankId || !isStockSufficient()}
                    className={!isStockSufficient() ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    {!isStockSufficient() ? "Stock insuffisant" : "Enregistrer"}
                  </Button>
                </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            {movements.length > 0 && (
              <Button variant="outline" size="default" onClick={printMovementSlip} className="font-medium">
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Imprimer le bordereau
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="default" className="font-medium">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportMovements("csv")}>
                  Exporter en CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportMovements("excel")}>
                  Exporter en Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <CardTitle>Historique des Mouvements</CardTitle>
          <CardDescription>
            {movements.length} mouvement{movements.length !== 1 ? "s" : ""} affiché{movements.length !== 1 ? "s" : ""} sur {totalMovements} total
            {totalPages > 1 && ` - Page ${currentPage} sur ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Section des filtres */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Filtres</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Filtre par banque */}
              <div className="space-y-2">
                <Label htmlFor="filter-bank" className="text-sm">Banque</Label>
                <Select
                  value={filters.bankId}
                  onValueChange={(value) => setFilters({ ...filters, bankId: value, cardId: "all" })}
                >
                  <SelectTrigger id="filter-bank">
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

              {/* Filtre par carte */}
              <div className="space-y-2">
                <Label htmlFor="filter-card" className="text-sm">Carte</Label>
                <Select
                  value={filters.cardId}
                  onValueChange={(value) => setFilters({ ...filters, cardId: value })}
                  disabled={filters.bankId === "all" && cards.length > 20}
                >
                  <SelectTrigger id="filter-card">
                    <SelectValue placeholder={filters.bankId !== "all" ? "Toutes les cartes" : "Sélectionnez une banque d'abord"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les cartes</SelectItem>
                    {getCardsForFilter().map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtre par type de mouvement */}
              <div className="space-y-2">
                <Label htmlFor="filter-type" className="text-sm">Type de mouvement</Label>
                <Select
                  value={filters.movementType}
                  onValueChange={(value) => {
                    // Réinitialiser les filtres d'emplacement selon le type
                    const newFilters: any = { ...filters, movementType: value }
                    if (value === "entry") {
                      // Pour "Entrée", on ne peut pas avoir d'emplacement source
                      newFilters.fromLocationId = "all"
                    } else if (value === "exit") {
                      // Pour "Sortie", on ne peut pas avoir d'emplacement destination
                      newFilters.toLocationId = "all"
                    }
                    setFilters(newFilters)
                  }}
                >
                  <SelectTrigger id="filter-type">
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="entry">Entrée</SelectItem>
                    <SelectItem value="exit">Sortie</SelectItem>
                    <SelectItem value="transfer">Transfert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtre par emplacement source (De) - Masqué pour "Entrée" */}
              {filters.movementType !== "entry" && (
                <div className="space-y-2">
                  <Label htmlFor="filter-from-location" className="text-sm">Emplacement De</Label>
                  <Select
                    value={filters.fromLocationId}
                    onValueChange={(value) => setFilters({ ...filters, fromLocationId: value })}
                  >
                    <SelectTrigger id="filter-from-location">
                      <SelectValue placeholder="Tous les emplacements" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les emplacements</SelectItem>
                      {(filters.bankId && filters.bankId !== "all" 
                        ? locations.filter(l => l.bankId === filters.bankId)
                        : locations
                      ).map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Filtre par emplacement destination (Vers) - Masqué pour "Sortie" */}
              {filters.movementType !== "exit" && (
                <div className="space-y-2">
                  <Label htmlFor="filter-to-location" className="text-sm">Emplacement Vers</Label>
                  <Select
                    value={filters.toLocationId}
                    onValueChange={(value) => setFilters({ ...filters, toLocationId: value })}
                  >
                    <SelectTrigger id="filter-to-location">
                      <SelectValue placeholder="Tous les emplacements" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les emplacements</SelectItem>
                      {(filters.bankId && filters.bankId !== "all" 
                        ? locations.filter(l => l.bankId === filters.bankId)
                        : locations
                      ).map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Filtre par date de début */}
              <div className="space-y-2">
                <Label htmlFor="filter-date-from" className="text-sm">Date de début</Label>
                <Input
                  id="filter-date-from"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                />
              </div>

              {/* Filtre par date de fin */}
              <div className="space-y-2">
                <Label htmlFor="filter-date-to" className="text-sm">Date de fin</Label>
                <Input
                  id="filter-date-to"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                />
              </div>

              {/* Recherche par mot-clé */}
              <div className="space-y-2">
                <Label htmlFor="filter-search" className="text-sm">Recherche</Label>
                <Input
                  id="filter-search"
                  type="text"
                  placeholder="Numéro, carte, motif, utilisateur..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                />
              </div>

              {/* Bouton Réinitialiser */}
              <div className="flex items-end">
                <Button variant="outline" onClick={resetFilters}>
                  <Filter className="h-4 w-4 mr-2" />
                  Réinitialiser
                </Button>
              </div>
            </div>
          </div>

          {movements.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900">Aucun mouvement</h3>
              <p className="mt-1 text-sm text-slate-500">Commencez par enregistrer votre premier mouvement de stock.</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900">Aucun résultat</h3>
              <p className="mt-1 text-sm text-slate-500">Aucun mouvement ne correspond aux filtres sélectionnés.</p>
              <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                Réinitialiser les filtres
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Actions</TableHead>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Date et Heure</TableHead>
                      <TableHead>Banque</TableHead>
                      <TableHead>Carte</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead>Vers</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Motif</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Utilisateur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(movements) ? movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => printSingleMovement(movement)}
                            title="Imprimer ce mouvement"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                              />
                            </svg>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMovementToDelete(movement)}
                            title="Supprimer ce mouvement"
                            aria-label={`Supprimer le mouvement ${getCardName(movement.cardId)}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap font-mono">
                          {movement.reference || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDateTime(movement.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(() => {
                            const card = cards.find(c => c.id === movement.cardId)
                            return card ? getBankName(card.bankId) : "N/A"
                          })()}
                        </TableCell>
                        <TableCell className="font-medium">{getCardName(movement.cardId)}</TableCell>
                        <TableCell>
                          <Badge variant={getMovementTypeBadge(movement.movementType) as any}>
                            {getMovementTypeLabel(movement.movementType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {movement.fromLocationId ? getLocationName(movement.fromLocationId) : "-"}
                        </TableCell>
                        <TableCell>{movement.toLocationId ? getLocationName(movement.toLocationId) : "-"}</TableCell>
                        <TableCell>{movement.quantity}</TableCell>
                        <TableCell className="max-w-xs truncate">{movement.reason}</TableCell>
                        <TableCell>
                          {movement.documentUrl ? (
                            <a
                              href={movement.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                              title={movement.documentName || "Voir le document"}
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{getUserName(movement.userId)}</TableCell>
                      </TableRow>
                    )) : null}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Affichage de {(currentPage - 1) * movementsPerPage + 1} à {Math.min(currentPage * movementsPerPage, totalMovements)} sur {totalMovements} mouvement{totalMovements !== 1 ? "s" : ""}
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {/* Numéros de page */}
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
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => handlePageChange(pageNum)}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
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

      {/* Confirmation de suppression : l'action est définitive et modifie le stock,
          elle doit donc être explicitement confirmée. */}
      <AlertDialog
        open={movementToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setMovementToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce mouvement ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="font-medium text-destructive">
                  ⚠️ Cette action est irréversible et modifie le stock.
                </p>
                {movementToDelete && (
                  <div className="rounded-md border bg-muted/50 p-3 text-sm">
                    <div>
                      <strong>Carte :</strong> {getCardName(movementToDelete.cardId)}
                    </div>
                    <div>
                      <strong>Type :</strong> {getMovementTypeLabel(movementToDelete.movementType)}
                    </div>
                    <div>
                      <strong>Quantité :</strong> {movementToDelete.quantity}
                    </div>
                    <div>
                      <strong>Date :</strong> {formatDateTime(movementToDelete.createdAt)}
                    </div>
                  </div>
                )}
                {movementToDelete && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <div className="font-semibold">Effet sur le stock</div>
                    <p className="mt-1">{decrireAnnulation(movementToDelete)}</p>
                  </div>
                )}
                <p>
                  Si cette annulation devait rendre un stock négatif, la suppression sera refusée.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Empêche la fermeture automatique : on ferme nous-mêmes une fois
                // la réponse du serveur connue (succès comme refus).
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
