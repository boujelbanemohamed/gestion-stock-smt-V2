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
    cardQuantities: [] as { cardId: string; quantity: number }[], // Quantité par carte
    fromLocationId: "",
    toLocationId: "",
    movementType: "entry" as "entry" | "exit" | "transfer",
    reason: "",
  })

  const [formErrors, setFormErrors] = useState<{
    quantity?: string
    fromLocationId?: string
    toLocationId?: string
  }>({})
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false)

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
          const bankAddress = bank?.address || ""
          const destination = movement.movementType === 'exit' 
            ? (bankAddress ? `${bankName}<br/>${bankAddress}` : bankName)
            : (movement.toLocationId ? getLocationName(movement.toLocationId) : "-")
          
          return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${formatDateTime(movement.createdAt)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${getCardName(movement.cardId)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${getMovementTypeLabel(movement.movementType)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${movement.fromLocationId ? getLocationName(movement.fromLocationId) : "-"}</td>
          <td style="border: 1px solid #ddd; padding: 8px;" class="destination-cell">${destination}</td>
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
            .destination-cell {
              font-size: 12px;
              line-height: 1.3;
            }
            .recipient-section {
              font-size: 11px;
            }
            .recipient-section h3 {
              font-size: 14px;
            }
            .recipient-section p {
              font-size: 11px;
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
          
          <div class="recipient-section" style="margin-top: 40px; padding: 20px; border-top: 2px solid #1e293b;">
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
    const bankAddress = bank?.address || ""
    const destinationInfo = movement.movementType === 'exit' 
      ? (bankAddress ? `${bankName}<br/>${bankAddress}` : bankName)
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
        <td style="border: 1px solid #ddd; padding: 8px;" class="destination-cell">${destinationInfo}</td>
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
            .destination-cell {
              font-size: 12px;
              line-height: 1.3;
            }
            .recipient-section {
              font-size: 11px;
            }
            .recipient-section h3 {
              font-size: 14px;
            }
            .recipient-section p {
              font-size: 11px;
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
          
          <div class="recipient-section" style="margin-top: 40px; padding: 20px; border-top: 2px solid #1e293b;">
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

    // Validation des quantités par carte (déjà fait dans la boucle ci-dessus)

    // Validate cards belong to selected bank
    if (formData.cardQuantities.length === 0) {
      alert("Veuillez sélectionner au moins une carte")
      return
    }

    for (const cardQuantity of formData.cardQuantities) {
      const card = cards.find(c => c.id === cardQuantity.cardId)
      if (card && card.bankId !== formData.bankId) {
        alert("Une des cartes sélectionnées n'appartient pas à la banque choisie")
        return
      }
      if (cardQuantity.quantity <= 0) {
        alert(`La quantité pour la carte ${card?.name} doit être supérieure à 0`)
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
          const message = `❌ Le mouvement ne peut pas être effectué à cause de quantités insuffisantes:\n\n` +
            insufficientCards.map(card => 
              `• ${card.cardName}: ${card.available} disponible (demandé: ${card.requested}, manque: ${card.missing})`
            ).join('\n') +
            `\n\nVeuillez ajuster les quantités ou choisir un autre emplacement source.`
          
          alert(message)
          return
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
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

      for (const cardQuantity of formData.cardQuantities) {
        const movementData = {
          ...formData,
          cardId: cardQuantity.cardId,
          quantity: cardQuantity.quantity, // Quantité spécifique à cette carte
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
          createdMovements.push(data.data)
        } else {
          errorCount++
          const card = cards.find(c => c.id === cardQuantity.cardId)
          console.error(`Erreur pour la carte ${card?.name}:`, data.error)
        }
      }

      await loadData()
      // Impression d'un bon consolidé si plusieurs cartes (génération en masse)
      if (bulkContext.cardQuantities.length > 1 && successCount > 0) {
        printBulkSlip(bulkContext, createdMovements)
      }
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

  // Impression d'un bon consolidé pour la génération en masse
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
    const bank = banks.find(b => b.id === ctx.bankId)
    // Champ "De":
    // - Pour une SORTIE: afficher l'adresse fixe SMT - MT demandée
    // - Sinon: afficher nom + adresse de l'emplacement source si disponible
    let fromName = '-'
    if (ctx.movementType === 'exit') {
      fromName = 'SMT  - Centre urbain Nord, Sana Center, bloc C – 1082, Tunis - Tunisie'
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

    const rows = ctx.cardQuantities.map(cq => {
      const card = cards.find(c => c.id === cq.cardId) as any
      return `
        <tr>
          <td style="border:1px solid #ddd;padding:8px;">${card?.name || '-'}</td>
          <td style="border:1px solid #ddd;padding:8px;">${card?.type || '-'}</td>
          <td style="border:1px solid #ddd;padding:8px;">${card?.subType || '-'}</td>
          <td style="border:1px solid #ddd;padding:8px;">${card?.subSubType || '-'}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:right;">${cq.quantity}</td>
        </tr>
      `
    }).join('')

    const totalQty = ctx.cardQuantities.reduce((s, cq) => s + (cq.quantity || 0), 0)

    const w = window.open('', '_blank')
    if (!w) return
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Bon de mouvement (Consolidé)</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .company-name { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
          .bank-name { font-size: 24px; font-weight: bold; color: #1f2937; }
          .date { color: #6b7280; margin-top: 10px; }
          .meta-grid { margin-top: 10px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; color: #374151; }
          .meta-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
          .meta-label { font-size: 12px; color: #6b7280; display: block; }
          .meta-value { font-size: 14px; font-weight: 600; }
          .cards-details { margin-top: 15px; }
          .cards-details h4 { font-size: 16px; color: #374151; margin-bottom: 10px; }
          .cards-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .cards-table th, .cards-table td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
          .cards-table th { background-color: #f9fafb; font-weight: bold; color: #374151; }
          .cards-table tr:nth-child(even) { background-color: #f9fafb; }
          .quantity { text-align: right; font-weight: bold; color: #059669; }
          .total { margin-top: 30px; padding: 20px; background-color: #f3f4f6; border-radius: 8px; text-align: center; }
          .total-label { font-size: 18px; color: #374151; }
          .total-value { font-size: 24px; font-weight: bold; color: #059669; margin-top: 5px; }
          .footer { margin-top: 40px; text-align: center; padding: 20px; border-top: 1px solid #e5e7eb; }
          .footer-address { font-size: 12px; color: #6b7280; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Société Monétique Tunisie</div>
          <div class="bank-name">${bank?.name || ''}</div>
          <div class="date">Bon de Mouvement de Stock (Consolidé) - ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">Type</span><span class="meta-value">${getMovementTypeLabel(ctx.movementType)}</span></div>
          <div class="meta-item"><span class="meta-label">Motif</span><span class="meta-value">${ctx.reason || '-'}</span></div>
          <div class="meta-item"><span class="meta-label">De</span><span class="meta-value">${fromName}</span></div>
          <div class="meta-item"><span class="meta-label">Vers / Adresse</span><span class="meta-value">${destinationInfo}</span></div>
          <div class="meta-item"><span class="meta-label">Généré par</span><span class="meta-value">${currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'N/A'}</span></div>
          <div class="meta-item"><span class="meta-label">Heure</span><span class="meta-value">${new Date().toLocaleTimeString('fr-FR')}</span></div>
        </div>

        <div class="cards-details">
          <h4>Détails des cartes</h4>
          <table class="cards-table">
            <thead>
              <tr>
                <th>Nom de la carte</th>
                <th>Type</th>
                <th>Sous-type</th>
                <th>Sous-sous-type</th>
                <th>Quantité</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div class="total">
          <div class="total-label">Total des cartes dans le bon</div>
          <div class="total-value">${totalQty} cartes</div>
        </div>

        ${ctx.movementType === 'exit' ? `
        <div style="margin-top: 30px; padding-top: 10px;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top; width:50%; padding:10px; border:1px solid #e5e7eb;">
                <div style="font-weight:bold; color:#374151; margin-bottom:8px;">Expéditeur</div>
                <div style="margin-top:8px; font-size:12px; color:#6b7280;">Nom & Prénom :</div>
                <div style="height:28px; border-bottom:1px solid #1e293b; margin-bottom:14px;"></div>
                <div style="margin-top:8px; font-size:12px; color:#6b7280;">Signature et Cachet :</div>
                <div style="height:50px; border:1px dashed #9ca3af; margin-top:6px;"></div>
              </td>
              <td style="vertical-align:top; width:50%; padding:10px; border:1px solid #e5e7eb;">
                <div style="font-weight:bold; color:#374151; margin-bottom:8px;">Destinataire</div>
                <div style="margin-top:8px; font-size:12px; color:#6b7280;">Nom & Prénom :</div>
                <div style="height:28px; border-bottom:1px solid #1e293b; margin-bottom:14px;"></div>
                <div style="margin-top:8px; font-size:12px; color:#6b7280;">Signature et Cachet :</div>
                <div style="height:50px; border:1px dashed #9ca3af; margin-top:6px;"></div>
              </td>
            </tr>
          </table>
        </div>
        ` : ''}

        <div class="footer">
          <div class="footer-address">Centre urbain Nord, Sana Center, bloc C – 1082, Tunis</div>
        </div>
        <script>window.onload = () => window.print()</script>
      </body>
      </html>
    `
    w.document.write(html)
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
    setFormErrors({})
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
      alert("Veuillez sélectionner une banque et un emplacement source (De)")
      return
    }

    if (formData.movementType !== "exit" && formData.movementType !== "transfer") {
      alert("La génération en masse est disponible uniquement pour les mouvements de type Sortie et Transfert")
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
        alert("Aucune carte avec stock disponible trouvée dans cet emplacement")
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
      alert(`${totalCardsGenerated} carte(s) avec stock disponible ${wasEmpty ? 'sélectionnée(s)' : 'ajoutée(s)'} automatiquement avec leur stock complet.\n\nTotal: ${totalCardsNow} carte(s) sélectionnée(s).\n\nVous pouvez maintenant modifier les quantités si nécessaire.`)
    } catch (error) {
      console.error('Error generating bulk movements:', error)
      alert('Erreur lors de la génération en masse des mouvements')
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
                      
                      {/* Bouton Générer en masse */}
                      {formData.bankId && formData.fromLocationId && (
                        <div className="grid grid-cols-4 items-center gap-4">
                          <div className="col-span-4 flex justify-center">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={generateBulkMovements}
                              disabled={isGeneratingBulk || !formData.bankId || !formData.fromLocationId}
                              className="w-full sm:w-auto"
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
                          </div>
                        </div>
                      )}
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
