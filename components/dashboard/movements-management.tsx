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
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"
import type { Movement, Card as CardType, Location, Bank } from "@/lib/types"
import { Filter } from "lucide-react"
import { getAuthHeaders } from "@/lib/api-client"

export default function MovementsManagement() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [cards, setCards] = useState<CardType[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    bankId: "",
    cardIds: [] as string[], // Changé pour permettre plusieurs cartes
    fromLocationId: "",
    toLocationId: "",
    movementType: "entry" as "entry" | "exit" | "transfer",
    quantity: 0,
    reason: "",
  })

  const [formErrors, setFormErrors] = useState<{
    quantity?: string
    fromLocationId?: string
    toLocationId?: string
  }>({})

  // États pour les filtres
  const [filters, setFilters] = useState({
    bankId: "all",
    cardId: "all",
    movementType: "all",
    dateFrom: "",
    dateTo: "",
    searchTerm: ""
  })

  useEffect(() => {
    loadData()
    loadCurrentUser()
  }, [])

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

  const loadData = async () => {
    try {
      // Charger les mouvements
      const movementsResponse = await fetch('/api/movements')
      const movementsData = await movementsResponse.json()
      if (movementsData.success) {
        setMovements(movementsData.data || [])
      }

      // Charger les cartes
      const cardsResponse = await fetch('/api/cards')
      const cardsData = await cardsResponse.json()
      if (cardsData.success) {
        setCards(cardsData.data || [])
      }

      // Charger les emplacements
      const locationsResponse = await fetch('/api/locations')
      const locationsData = await locationsResponse.json()
      if (locationsData.success) {
        setLocations(locationsData.data.filter((l: any) => l.isActive) || [])
      }

      // Charger les banques
      const banksResponse = await fetch('/api/banks?status=active')
      const banksData = await banksResponse.json()
      if (banksData.success) {
        setBanks(banksData.data || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  useDataSync(["movements", "cards", "locations", "banks"], loadData)
  useAutoRefresh(loadData, 120000) // 2 minutes

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
    const movement = movements.find(m => m.userId === userId)
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

  const printMovementSlip = () => {
    if (!currentUser) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const movementsHtml = movements
      .slice()
      .reverse()
      .map(
        (movement) => {
          // Pour les sorties, afficher le nom et l'adresse de la banque au lieu de l'emplacement destination
          const card = cards.find(c => c.id === movement.cardId)
          const bank = card ? banks.find(b => b.id === card.bankId) : null
          const bankName = bank?.name || "Banque non trouvée"
          const bankAddress = bank?.address || "Adresse non renseignée"
          const destination = movement.movementType === 'exit' 
            ? `${bankName}<br/>${bankAddress}` 
            : (movement.toLocationId ? getLocationName(movement.toLocationId) : "-")
          
          return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${formatDateTime(movement.createdAt)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${getCardName(movement.cardId)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${getMovementTypeLabel(movement.movementType)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${movement.fromLocationId ? getLocationName(movement.fromLocationId) : "-"}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${destination}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${movement.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${movement.reason}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${getUserName(movement.userId)}</td>
        </tr>
      `
        }
      )
      .join("")

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bordereau de Mouvements</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              text-align: center;
              color: #1e293b;
              margin-bottom: 10px;
            }
            .header-info {
              text-align: center;
              margin-bottom: 20px;
              color: #64748b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #1e293b;
              color: white;
              padding: 12px;
              text-align: left;
              border: 1px solid #ddd;
            }
            td {
              padding: 8px;
              border: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #64748b;
              font-size: 12px;
            }
            @media print {
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>Société Monétique Tunisie</h1>
          <h2 style="text-align: center; color: #1e293b; margin-bottom: 20px;">Bordereau de Mouvements de Stock</h2>
          <div class="header-info">
            <p>Généré le ${new Date().toLocaleString("fr-FR")}</p>
            <p>Bon de mouvement généré par : ${currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "N/A"}</p>
            <p>Total: ${movements.length} mouvement(s)</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date et Heure</th>
                <th>Carte</th>
                <th>Type</th>
                <th>De</th>
                <th>Vers / Adresse</th>
                <th>Quantité</th>
                <th>Motif</th>
                <th>Bon de mouvement généré par</th>
              </tr>
            </thead>
            <tbody>
              ${movementsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 40px; padding: 20px; border-top: 2px solid #1e293b;">
            <h3 style="color: #1e293b; margin-bottom: 30px;">Destinataire :</h3>
            
            <div style="display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 20px;">
              <div style="flex: 1; min-width: 200px;">
                <p style="font-weight: bold; margin-bottom: 5px; color: #374151;">Nom :</p>
                <div style="border-bottom: 2px solid #1e293b; height: 30px; margin-bottom: 20px;"></div>
              </div>
              <div style="flex: 1; min-width: 200px;">
                <p style="font-weight: bold; margin-bottom: 5px; color: #374151;">Prénom :</p>
                <div style="border-bottom: 2px solid #1e293b; height: 30px; margin-bottom: 20px;"></div>
              </div>
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 20px;">
              <div style="flex: 1; min-width: 200px;">
                <p style="font-weight: bold; margin-bottom: 5px; color: #374151;">Fonction :</p>
                <div style="border-bottom: 2px solid #1e293b; height: 30px; margin-bottom: 20px;"></div>
              </div>
              <div style="flex: 1; min-width: 200px;">
                <p style="font-weight: bold; margin-bottom: 5px; color: #374151;">Date :</p>
                <div style="border-bottom: 2px solid #1e293b; height: 30px; margin-bottom: 20px;"></div>
              </div>
            </div>
            
            <div style="margin-top: 40px; text-align: right;">
              <p style="font-weight: bold; margin-bottom: 60px; color: #374151;">Signature :</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Adresse : Centre urbain Nord, Sana Center, bloc C – 1082, Tunis</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  const printSingleMovement = (movement: Movement) => {
    if (!currentUser) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    // Récupérer le nom et l'adresse de la banque pour les sorties
    const card = cards.find(c => c.id === movement.cardId)
    const bank = card ? banks.find(b => b.id === card.bankId) : null
    const bankName = bank?.name || "Banque non trouvée"
    const bankAddress = bank?.address || "Adresse non renseignée"
    const destinationInfo = movement.movementType === 'exit' 
      ? `${bankName}<br/>${bankAddress}` 
      : (movement.toLocationId ? getLocationName(movement.toLocationId) : "-")

    const movementHtml = `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Date et Heure:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${formatDateTime(movement.createdAt)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Carte:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${getCardName(movement.cardId)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Type de mouvement:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${getMovementTypeLabel(movement.movementType)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Emplacement source:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${movement.fromLocationId ? getLocationName(movement.fromLocationId) : "-"}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>${movement.movementType === 'exit' ? 'Banque de destination' : 'Emplacement destination'}:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${destinationInfo}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Quantité:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${movement.quantity}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Motif:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${movement.reason}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Bon de mouvement généré par :</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${getUserName(movement.userId)}</td>
      </tr>
    `

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bordereau de Mouvement - ${movement.id}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              text-align: center;
              color: #1e293b;
              margin-bottom: 10px;
            }
            .header-info {
              text-align: center;
              margin-bottom: 30px;
              color: #64748b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            td {
              padding: 12px;
              border: 1px solid #ddd;
            }
            td:first-child {
              background-color: #f8fafc;
              font-weight: bold;
              width: 40%;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #64748b;
              font-size: 12px;
            }
            @media print {
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>Société Monétique Tunisie</h1>
          <h2 style="text-align: center; color: #1e293b; margin-bottom: 20px;">Bordereau de Mouvement de Stock</h2>
          <div class="header-info">
            <p>Généré le ${new Date().toLocaleString("fr-FR")}</p>
            <p>Bon de mouvement généré par : ${currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "N/A"}</p>
          </div>
          <table>
            <tbody>
              ${movementHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 40px; padding: 20px; border-top: 2px solid #1e293b;">
            <h3 style="color: #1e293b; margin-bottom: 30px;">Destinataire :</h3>
            
            <div style="display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 20px;">
              <div style="flex: 1; min-width: 200px;">
                <p style="font-weight: bold; margin-bottom: 5px; color: #374151;">Nom :</p>
                <div style="border-bottom: 2px solid #1e293b; height: 30px; margin-bottom: 20px;"></div>
              </div>
              <div style="flex: 1; min-width: 200px;">
                <p style="font-weight: bold; margin-bottom: 5px; color: #374151;">Prénom :</p>
                <div style="border-bottom: 2px solid #1e293b; height: 30px; margin-bottom: 20px;"></div>
              </div>
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 20px;">
              <div style="flex: 1; min-width: 200px;">
                <p style="font-weight: bold; margin-bottom: 5px; color: #374151;">Fonction :</p>
                <div style="border-bottom: 2px solid #1e293b; height: 30px; margin-bottom: 20px;"></div>
              </div>
              <div style="flex: 1; min-width: 200px;">
                <p style="font-weight: bold; margin-bottom: 5px; color: #374151;">Date :</p>
                <div style="border-bottom: 2px solid #1e293b; height: 30px; margin-bottom: 20px;"></div>
              </div>
            </div>
            
            <div style="margin-top: 40px; text-align: right;">
              <p style="font-weight: bold; margin-bottom: 60px; color: #374151;">Signature :</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Adresse : Centre urbain Nord, Sana Center, bloc C – 1082, Tunis</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  const getAvailableStock = (cardId: string, locationId: string): number => {
    if (!cardId || !locationId) return 0
    const card: any = cards.find((c: any) => c.id === cardId)
    if (!card) return 0

    // Source de vérité: stockLevels (quantité par emplacement) fournis par l'API
    const level = (card.stockLevels || []).find((sl: any) => sl.locationId === locationId || sl.location?.id === locationId)
    if (level) return Number(level.quantity) || 0

    // Fallback (ancien calcul): dériver des mouvements si stockLevels absent
    const cardMovements = movements.filter((m) => m.cardId === cardId)
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
    } = {}

    // Validate bankId
    if (!formData.bankId) {
      alert("Veuillez sélectionner une banque")
      return
    }

    // Validate quantity is positive
    if (formData.quantity <= 0) {
      errors.quantity = "La quantité doit être supérieure à 0"
    }

    // Validate cards belong to selected bank
    if (formData.cardIds.length === 0) {
      alert("Veuillez sélectionner au moins une carte")
      return
    }

    for (const cardId of formData.cardIds) {
      const card = cards.find(c => c.id === cardId)
      if (card && card.bankId !== formData.bankId) {
        alert("Une des cartes sélectionnées n'appartient pas à la banque choisie")
        return
      }
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

    // Validate available stock for exit and transfer
    if (formData.movementType === "exit" || formData.movementType === "transfer") {
      if (formData.fromLocationId && formData.cardIds.length > 0) {
        // Vérifier le stock pour chaque carte sélectionnée
        for (const cardId of formData.cardIds) {
          const availableStock = getAvailableStock(cardId, formData.fromLocationId)
          if (formData.quantity > availableStock) {
            const card = cards.find(c => c.id === cardId)
            errors.quantity = `Stock insuffisant pour la carte ${card?.name} à cet emplacement (disponible: ${availableStock})`
            break
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})

    // Créer un mouvement pour chaque carte sélectionnée
    try {
      let successCount = 0
      let errorCount = 0

      for (const cardId of formData.cardIds) {
        const movementData = {
          ...formData,
          cardId: cardId, // Une carte à la fois
          userId: currentUser?.id || '',
          fromLocationId: formData.movementType === "entry" ? null : formData.fromLocationId || null,
          toLocationId: formData.movementType === "exit" ? null : formData.toLocationId || null,
        }

        const response = await fetch('/api/movements', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(movementData)
        })

        const data = await response.json()
        if (data.success) {
          successCount++
        } else {
          errorCount++
          console.error(`Erreur pour la carte ${cardId}:`, data.error)
        }
      }

      await loadData()
      resetForm()
      setIsDialogOpen(false)
      
      if (successCount > 0 && errorCount === 0) {
        alert(`${successCount} mouvement(s) créé(s) avec succès`)
      } else if (successCount > 0 && errorCount > 0) {
        alert(`${successCount} mouvement(s) créé(s), ${errorCount} erreur(s)`)
      } else {
        alert('Erreur lors de la création des mouvements')
      }
    } catch (error) {
      console.error('Error creating movements:', error)
      alert('Erreur lors de la création des mouvements')
    }
  }

  const resetForm = () => {
    setFormData({
      bankId: "",
      cardIds: [], // Changé pour plusieurs cartes
      fromLocationId: "",
      toLocationId: "",
      movementType: "entry",
      quantity: 0,
      reason: "",
    })
    setFormErrors({})
  }

  // Fonction pour gérer la sélection multiple de cartes
  const handleCardSelection = (cardId: string, isSelected: boolean) => {
    setFormData(prev => {
      if (isSelected) {
        // Ajouter la carte si elle n'est pas déjà sélectionnée
        if (!prev.cardIds.includes(cardId)) {
          return { ...prev, cardIds: [...prev.cardIds, cardId] }
        }
      } else {
        // Retirer la carte de la sélection
        return { ...prev, cardIds: prev.cardIds.filter(id => id !== cardId) }
      }
      return prev
    })
  }

  // Filtrer les cartes par banque sélectionnée
  const getFilteredCards = () => {
    if (!formData.bankId) return []
    return cards.filter(card => card.bankId === formData.bankId)
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
    return bank?.address || "Adresse non renseignée"
  }

  const getBankName = (bankId: string) => {
    const bank = banks.find(b => b.id === bankId)
    return bank ? bank.name : "N/A"
  }

  // Fonction de filtrage des mouvements
  const getFilteredMovements = () => {
    return movements.filter((movement) => {
      // Filtre par banque
      if (filters.bankId && filters.bankId !== "all") {
        const card = cards.find(c => c.id === movement.cardId)
        if (!card || card.bankId !== filters.bankId) return false
      }

      // Filtre par carte
      if (filters.cardId && filters.cardId !== "all" && movement.cardId !== filters.cardId) return false

      // Filtre par type de mouvement
      if (filters.movementType && filters.movementType !== "all" && movement.movementType !== filters.movementType) return false

      // Filtre par date de début
      if (filters.dateFrom) {
        const movementDate = new Date(movement.createdAt)
        const fromDate = new Date(filters.dateFrom)
        if (movementDate < fromDate) return false
      }

      // Filtre par date de fin
      if (filters.dateTo) {
        const movementDate = new Date(movement.createdAt)
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999) // Inclure toute la journée
        if (movementDate > toDate) return false
      }

      // Filtre par terme de recherche (motif)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase()
        const cardName = getCardName(movement.cardId).toLowerCase()
        const reason = movement.reason.toLowerCase()
        const userName = getUserName(movement.userId).toLowerCase()
        
        if (!cardName.includes(searchLower) && 
            !reason.includes(searchLower) && 
            !userName.includes(searchLower)) {
          return false
        }
      }

      return true
    })
  }

  // Réinitialiser les filtres
  const resetFilters = () => {
    setFilters({
      bankId: "all",
      cardId: "all",
      movementType: "all",
      dateFrom: "",
      dateTo: "",
      searchTerm: ""
    })
  }

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
          <p className="text-sm text-slate-600 mt-1">Suivez les mouvements de stock</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Les boutons ont été déplacés dans l'en-tête du tableau ci-dessous */}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} size="default" className="font-medium">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nouveau mouvement
                </Button>
              </DialogTrigger>
              <DialogContent className="w-full sm:max-w-[720px] md:max-w-[840px]">
                <DialogHeader>
                  <DialogTitle>Nouveau Mouvement</DialogTitle>
                  <DialogDescription>Enregistrez un nouveau mouvement de stock.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  {/* 1. Sélection de la banque (OBLIGATOIRE EN PREMIER) */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bank" className="text-right font-semibold">
                      Banque *
                    </Label>
                    <Select
                      value={formData.bankId}
                      onValueChange={(value) => {
                        setFormData({ ...formData, bankId: value, cardIds: [], fromLocationId: "", toLocationId: "" })
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
                      onValueChange={(value: "entry" | "exit" | "transfer") =>
                        setFormData({
                          ...formData,
                          movementType: value,
                          fromLocationId: "",
                          toLocationId: "",
                          // Préremplir le motif pour la sortie
                          reason: value === "exit" ? "Expédition" : formData.reason
                        })
                      }
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
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="fromLocation" className="text-right font-semibold">
                        Emplacement (De) *
                      </Label>
                      <div className="col-span-3">
                        <Select
                          value={formData.fromLocationId}
                          onValueChange={(value) => {
                            setFormData({ ...formData, fromLocationId: value })
                            if (formErrors.fromLocationId) {
                              setFormErrors({ ...formErrors, fromLocationId: undefined })
                            }
                            if (formErrors.quantity) {
                              setFormErrors({ ...formErrors, quantity: undefined })
                            }
                          }}
                          disabled={!formData.bankId}
                        >
                          <SelectTrigger className={formErrors.fromLocationId ? "border-red-500" : ""}>
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
                        {formErrors.fromLocationId && (
                          <p className="text-sm text-red-500 mt-1">{formErrors.fromLocationId}</p>
                        )}
                      </div>
                    </div>
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
                          <SelectTrigger className={formErrors.toLocationId ? "border-red-500" : ""}>
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
                        {formErrors.toLocationId && (
                          <p className="text-sm text-red-500 mt-1">{formErrors.toLocationId}</p>
                        )}
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
                      {!formData.bankId ? (
                        <p className="text-sm text-gray-500">Sélectionnez d'abord une banque</p>
                      ) : getFilteredCards().length === 0 ? (
                        <p className="text-sm text-gray-500">Aucune carte disponible pour cette banque</p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                          {getFilteredCards().map((card) => (
                            <div key={card.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`card-${card.id}`}
                                checked={formData.cardIds.includes(card.id)}
                                onChange={(e) => handleCardSelection(card.id, e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <label htmlFor={`card-${card.id}`} className="text-sm cursor-pointer">
                                {card.name} ({card.type} - {card.subType})
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                      {formData.cardIds.length > 0 && (
                        <p className="text-sm text-green-600 mt-2">
                          {formData.cardIds.length} carte(s) sélectionnée(s)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 7. Quantité */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="quantity" className="text-right font-semibold">
                      Quantité *
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="quantity"
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => {
                          setFormData({ ...formData, quantity: Number.parseInt(e.target.value) || 0 })
                          if (formErrors.quantity) {
                            setFormErrors({ ...formErrors, quantity: undefined })
                          }
                        }}
                        className={formErrors.quantity ? "border-red-500" : ""}
                        min="1"
                        required
                      />
                      {formErrors.quantity && <p className="text-sm text-red-500 mt-1">{formErrors.quantity}</p>}
                      {formData.cardIds.length > 0 &&
                        formData.fromLocationId &&
                        (formData.movementType === "exit" || formData.movementType === "transfer") && (
                          <div className="text-sm text-slate-500 mt-1">
                            <p>Stock disponible par carte:</p>
                            {formData.cardIds.map(cardId => {
                              const card = cards.find(c => c.id === cardId)
                              const stock = getAvailableStock(cardId, formData.fromLocationId)
                              return (
                                <p key={cardId} className="ml-2">
                                  • {card?.name}: {stock}
                                </p>
                              )
                            })}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* 8. Motif */}
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="reason" className="text-right mt-2 font-semibold">
                      Motif *
                    </Label>
                    <Textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="col-span-3"
                      placeholder="Motif du mouvement"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!formData.bankId}>Enregistrer</Button>
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
          </div>
          
          <CardTitle>Historique des Mouvements</CardTitle>
          <CardDescription>
            {getFilteredMovements().length} mouvement{getFilteredMovements().length !== 1 ? "s" : ""} affiché{getFilteredMovements().length !== 1 ? "s" : ""} sur {movements.length} total
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
                  onValueChange={(value) => setFilters({ ...filters, movementType: value })}
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
                  placeholder="Carte, motif, utilisateur..."
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
          ) : getFilteredMovements().length === 0 ? (
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Actions</TableHead>
                    <TableHead>Date et Heure</TableHead>
                    <TableHead>Banque</TableHead>
                    <TableHead>Carte</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>De</TableHead>
                    <TableHead>Vers</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Utilisateur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredMovements()
                    .slice()
                    .reverse()
                    .map((movement) => (
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
                        <TableCell className="text-sm">{getUserName(movement.userId)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
