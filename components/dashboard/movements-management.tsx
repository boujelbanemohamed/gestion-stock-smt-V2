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
import { dataStore } from "@/lib/data-store"
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"
import type { Movement, Card as CardType, Location } from "@/lib/types"

export default function MovementsManagement() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [cards, setCards] = useState<CardType[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    cardId: "",
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

  useEffect(() => {
    loadData()
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      // Simuler un utilisateur courant (à remplacer par une vraie session)
      const usersResponse = await fetch('/api/users')
      const usersData = await usersResponse.json()
      if (usersData.success && usersData.data.length > 0) {
        // Prendre le premier admin
        const admin = usersData.data.find((u: any) => u.role === 'admin')
        setCurrentUser(admin || usersData.data[0])
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
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  useDataSync(["movements", "cards", "locations", "banks"], loadData)
  useAutoRefresh(loadData, 30000)

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
        (movement) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${formatDateTime(movement.createdAt)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${getCardName(movement.cardId)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${getMovementTypeLabel(movement.movementType)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${movement.fromLocationId ? getLocationName(movement.fromLocationId) : "-"}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${movement.toLocationId ? getLocationName(movement.toLocationId) : "-"}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${movement.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${movement.reason}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${getUserName(movement.userId)}</td>
        </tr>
      `,
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
          <h1>Bordereau de Mouvements de Stock</h1>
          <div class="header-info">
            <p>Généré le ${new Date().toLocaleString("fr-FR")}</p>
            <p>Par ${currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "N/A"}</p>
            <p>Total: ${movements.length} mouvement(s)</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date et Heure</th>
                <th>Carte</th>
                <th>Type</th>
                <th>De</th>
                <th>Vers</th>
                <th>Quantité</th>
                <th>Motif</th>
                <th>Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              ${movementsHtml}
            </tbody>
          </table>
          <div class="footer">
            <p>Document généré automatiquement par le système de gestion de stock</p>
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
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Emplacement destination:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${movement.toLocationId ? getLocationName(movement.toLocationId) : "-"}</td>
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
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Utilisateur:</strong></td>
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
          <h1>Bordereau de Mouvement de Stock</h1>
          <div class="header-info">
            <p>Généré le ${new Date().toLocaleString("fr-FR")}</p>
            <p>Par ${currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "N/A"}</p>
          </div>
          <table>
            <tbody>
              ${movementHtml}
            </tbody>
          </table>
          <div class="footer">
            <p>Document généré automatiquement par le système de gestion de stock</p>
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
    const card = cards.find((c) => c.id === cardId)
    if (!card) return 0

    // Get all movements for this card and location
    const cardMovements = movements.filter((m) => m.cardId === cardId)

    // Calculate stock at this location
    let stock = 0
    for (const movement of cardMovements) {
      if (movement.toLocationId === locationId) {
        stock += movement.quantity
      }
      if (movement.fromLocationId === locationId) {
        stock -= movement.quantity
      }
    }

    return stock
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) return
    if (!currentUser) return

    const errors: {
      quantity?: string
      fromLocationId?: string
      toLocationId?: string
    } = {}

    // Validate quantity is positive
    if (formData.quantity <= 0) {
      errors.quantity = "La quantité doit être supérieure à 0"
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
      if (formData.fromLocationId && formData.cardId) {
        const availableStock = getAvailableStock(formData.cardId, formData.fromLocationId)
        if (formData.quantity > availableStock) {
          errors.quantity = `Stock insuffisant à cet emplacement (disponible: ${availableStock})`
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})

    const movementData = {
      ...formData,
      userId: currentUser?.id || '',
      fromLocationId: formData.movementType === "entry" ? null : formData.fromLocationId || null,
      toLocationId: formData.movementType === "exit" ? null : formData.toLocationId || null,
    }

    try {
      const response = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movementData)
      })

      const data = await response.json()
      if (!data.success) {
        alert(data.error || 'Erreur lors de la création du mouvement')
        return
      }

      await loadData()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error creating movement:', error)
      alert('Erreur lors de la création du mouvement')
    }
  }

  const resetForm = () => {
    setFormData({
      cardId: "",
      fromLocationId: "",
      toLocationId: "",
      movementType: "entry",
      quantity: 0,
      reason: "",
    })
    setFormErrors({})
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Mouvements</h2>
          <p className="text-slate-600">Suivez les mouvements de stock</p>
        </div>
        <div className="flex gap-2">
          {movements.length > 0 && (
            <Button variant="outline" onClick={printMovementSlip}>
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nouveau mouvement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Nouveau Mouvement</DialogTitle>
                <DialogDescription>Enregistrez un nouveau mouvement de stock.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="card" className="text-right">
                      Carte
                    </Label>
                    <Select
                      value={formData.cardId}
                      onValueChange={(value) => {
                        setFormData({ ...formData, cardId: value })
                        if (formErrors.quantity) {
                          setFormErrors({ ...formErrors, quantity: undefined })
                        }
                      }}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Sélectionner une carte" />
                      </SelectTrigger>
                      <SelectContent>
                        {cards.map((card) => (
                          <SelectItem key={card.id} value={card.id}>
                            {card.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="movementType" className="text-right">
                      Type
                    </Label>
                    <Select
                      value={formData.movementType}
                      onValueChange={(value: "entry" | "exit" | "transfer") =>
                        setFormData({ ...formData, movementType: value, fromLocationId: "", toLocationId: "" })
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
                  {(formData.movementType === "exit" || formData.movementType === "transfer") && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="fromLocation" className="text-right">
                        De
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
                        >
                          <SelectTrigger className={formErrors.fromLocationId ? "border-red-500" : ""}>
                            <SelectValue placeholder="Emplacement source" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((location) => (
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
                  {(formData.movementType === "entry" || formData.movementType === "transfer") && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="toLocation" className="text-right">
                        Vers
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
                        >
                          <SelectTrigger className={formErrors.toLocationId ? "border-red-500" : ""}>
                            <SelectValue placeholder="Emplacement destination" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((location) => (
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
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="quantity" className="text-right">
                      Quantité
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
                      {formData.cardId &&
                        formData.fromLocationId &&
                        (formData.movementType === "exit" || formData.movementType === "transfer") && (
                          <p className="text-sm text-slate-500 mt-1">
                            Stock disponible: {getAvailableStock(formData.cardId, formData.fromLocationId)}
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="reason" className="text-right mt-2">
                      Motif
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
                  <Button type="submit">Enregistrer</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des Mouvements</CardTitle>
          <CardDescription>
            {movements.length} mouvement{movements.length !== 1 ? "s" : ""} enregistré
            {movements.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date et Heure</TableHead>
                    <TableHead>Carte</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>De</TableHead>
                    <TableHead>Vers</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements
                    .slice()
                    .reverse()
                    .map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDateTime(movement.createdAt)}
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
                        <TableCell className="text-right">
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
