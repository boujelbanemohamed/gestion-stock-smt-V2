"use client"

import { useState, useEffect, useMemo } from "react"
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
import { ArrowLeft, ClipboardList, Download, Printer, Trash2 } from "lucide-react"
import type { Bank, Inventory, InventoryLine } from "@/lib/types"
import { authenticatedFetch } from "@/lib/api-client"
import { exportToCsv } from "@/lib/export"
import { toast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"

const LIBELLE_STATUT: Record<string, string> = {
  in_progress: "En cours",
  completed: "Clôturé",
  adjusted: "Régularisé",
  cancelled: "Annulé",
}

const VARIANTE_STATUT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  in_progress: "default",
  completed: "secondary",
  adjusted: "outline",
  cancelled: "destructive",
}

function formatDateTime(valeur?: string | Date | null) {
  if (!valeur) return "-"
  return new Date(valeur).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Écart d'une ligne, ou null tant qu'elle n'a pas été comptée. */
function ecart(ligne: InventoryLine): number | null {
  return ligne.countedQuantity === null || ligne.countedQuantity === undefined
    ? null
    : ligne.countedQuantity - ligne.expectedQuantity
}

export default function InventoriesManagement() {
  const { hasPermission } = usePermissions()
  // Ouvrir, clôturer, régulariser et supprimer sont réservés à l'admin côté API :
  // on masque ici les actions correspondantes plutôt que d'afficher des boutons
  // qui échoueraient en 403.
  const estAdmin = hasPermission("movements", "delete")

  const [inventaires, setInventaires] = useState<Inventory[]>([])
  const [banques, setBanques] = useState<Bank[]>([])
  const [chargement, setChargement] = useState(true)

  // Inventaire ouvert en détail ; null = on affiche la liste.
  const [detail, setDetail] = useState<Inventory | null>(null)
  const [saisies, setSaisies] = useState<Record<string, string>>({})
  const [enregistrement, setEnregistrement] = useState(false)

  const [dialogueCreation, setDialogueCreation] = useState(false)
  const [banqueChoisie, setBanqueChoisie] = useState("")
  const [notes, setNotes] = useState("")
  const [creation, setCreation] = useState(false)

  const [aCloturer, setACloturer] = useState<Inventory | null>(null)
  const [aRegulariser, setARegulariser] = useState<Inventory | null>(null)
  const [aSupprimer, setASupprimer] = useState<Inventory | null>(null)
  const [action, setAction] = useState(false)

  const chargerInventaires = async () => {
    try {
      const reponse = await authenticatedFetch("/api/inventories")
      const json = await reponse.json()
      if (json.success) setInventaires(json.data || [])
    } catch (error) {
      console.error("Erreur chargement inventaires:", error)
    } finally {
      setChargement(false)
    }
  }

  const chargerBanques = async () => {
    try {
      const reponse = await authenticatedFetch("/api/banks")
      const json = await reponse.json()
      if (json.success) setBanques(json.data || [])
    } catch (error) {
      console.error("Erreur chargement banques:", error)
    }
  }

  useEffect(() => {
    chargerInventaires()
    chargerBanques()
  }, [])

  const ouvrirDetail = async (inventaire: Inventory) => {
    try {
      const reponse = await authenticatedFetch(`/api/inventories/${inventaire.id}`)
      const json = await reponse.json()
      if (!json.success) {
        toast({ title: "Erreur", description: json.error, variant: "destructive" })
        return
      }
      setDetail(json.data)
      const initiales: Record<string, string> = {}
      for (const ligne of json.data.lines ?? []) {
        initiales[ligne.id] = ligne.countedQuantity === null ? "" : String(ligne.countedQuantity)
      }
      setSaisies(initiales)
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'ouvrir l'inventaire", variant: "destructive" })
    }
  }

  const creerInventaire = async () => {
    if (!banqueChoisie) {
      toast({ title: "Banque requise", description: "Choisissez la banque à inventorier.", variant: "destructive" })
      return
    }
    setCreation(true)
    try {
      const reponse = await authenticatedFetch("/api/inventories", {
        method: "POST",
        body: JSON.stringify({ bankId: banqueChoisie, notes }),
      })
      const json = await reponse.json()
      if (!json.success) {
        toast({ title: "Ouverture impossible", description: json.error, variant: "destructive" })
        return
      }
      toast({
        title: "Inventaire ouvert",
        description: `${json.data.reference} — ${json.data.totalLines} ligne(s) à compter.`,
      })
      setDialogueCreation(false)
      setBanqueChoisie("")
      setNotes("")
      await chargerInventaires()
      await ouvrirDetail(json.data)
    } finally {
      setCreation(false)
    }
  }

  const enregistrerComptage = async () => {
    if (!detail) return
    setEnregistrement(true)
    try {
      const lignes = (detail.lines ?? []).map((ligne) => ({
        id: ligne.id,
        countedQuantity: saisies[ligne.id] === "" || saisies[ligne.id] === undefined ? null : Number(saisies[ligne.id]),
      }))
      const reponse = await authenticatedFetch(`/api/inventories/${detail.id}`, {
        method: "PUT",
        body: JSON.stringify({ lines: lignes }),
      })
      const json = await reponse.json()
      if (!json.success) {
        toast({ title: "Enregistrement refusé", description: json.error, variant: "destructive" })
        return
      }
      setDetail(json.data)
      toast({ title: "Comptage enregistré", description: `${json.data.countedLines}/${json.data.totalLines} ligne(s).` })
      await chargerInventaires()
    } finally {
      setEnregistrement(false)
    }
  }

  const cloturer = async () => {
    if (!aCloturer) return
    setAction(true)
    try {
      const reponse = await authenticatedFetch(`/api/inventories/${aCloturer.id}/complete`, { method: "POST" })
      const json = await reponse.json()
      if (!json.success) {
        toast({ title: "Clôture refusée", description: json.error, variant: "destructive" })
        return
      }
      toast({ title: "Inventaire clôturé", description: json.message })
      setACloturer(null)
      await chargerInventaires()
      await ouvrirDetail(aCloturer)
    } finally {
      setAction(false)
    }
  }

  const regulariser = async () => {
    if (!aRegulariser) return
    setAction(true)
    try {
      const reponse = await authenticatedFetch(`/api/inventories/${aRegulariser.id}/adjust`, { method: "POST" })
      const json = await reponse.json()
      if (!json.success) {
        toast({ title: "Régularisation refusée", description: json.error, variant: "destructive" })
        return
      }
      toast({ title: "Stock régularisé", description: json.message })
      setARegulariser(null)
      await chargerInventaires()
      await ouvrirDetail(aRegulariser)
    } finally {
      setAction(false)
    }
  }

  const supprimer = async () => {
    if (!aSupprimer) return
    setAction(true)
    try {
      const reponse = await authenticatedFetch(`/api/inventories/${aSupprimer.id}`, { method: "DELETE" })
      const json = await reponse.json()
      if (!json.success) {
        toast({ title: "Suppression refusée", description: json.error, variant: "destructive" })
        return
      }
      toast({ title: "Inventaire supprimé" })
      setASupprimer(null)
      if (detail?.id === aSupprimer.id) setDetail(null)
      await chargerInventaires()
    } finally {
      setAction(false)
    }
  }

  // --- Rapport ---------------------------------------------------------------
  const lignesDetail = detail?.lines ?? []
  const synthese = useMemo(() => {
    const comptees = lignesDetail.filter((l) => ecart(l) !== null)
    const ecarts = comptees.filter((l) => ecart(l) !== 0)
    return {
      total: lignesDetail.length,
      comptees: comptees.length,
      ecarts: ecarts.length,
      theorique: lignesDetail.reduce((t, l) => t + l.expectedQuantity, 0),
      compte: comptees.reduce((t, l) => t + (l.countedQuantity ?? 0), 0),
      excedents: ecarts.filter((l) => (ecart(l) ?? 0) > 0).length,
      manquants: ecarts.filter((l) => (ecart(l) ?? 0) < 0).length,
    }
  }, [lignesDetail])

  const exporterCsv = () => {
    if (!detail) return
    exportToCsv(
      `rapport-inventaire-${detail.reference}`,
      ["Emplacement", "Carte", "Type", "Quantité théorique", "Quantité comptée", "Écart"],
      lignesDetail.map((ligne) => [
        ligne.location?.name ?? "",
        ligne.card?.name ?? "",
        ligne.card?.type ?? "",
        ligne.expectedQuantity,
        ligne.countedQuantity ?? "",
        ecart(ligne) ?? "",
      ]),
    )
    toast({ title: "Export réussi", description: `${lignesDetail.length} ligne(s) exportée(s).` })
  }

  const imprimerRapport = () => {
    if (!detail) return
    const fenetre = window.open("", "_blank")
    if (!fenetre) return

    const lignesHtml = lignesDetail
      .map((ligne) => {
        const e = ecart(ligne)
        const couleur = e === null ? "#6b7280" : e === 0 ? "#111827" : e > 0 ? "#047857" : "#b91c1c"
        return `
        <tr>
          <td>${ligne.location?.name ?? ""}</td>
          <td>${ligne.card?.name ?? ""}</td>
          <td>${ligne.card?.type ?? ""}</td>
          <td style="text-align:right">${ligne.expectedQuantity}</td>
          <td style="text-align:right">${ligne.countedQuantity ?? "-"}</td>
          <td style="text-align:right; color:${couleur}; font-weight:${e && e !== 0 ? "bold" : "normal"}">${
            e === null ? "-" : e > 0 ? `+${e}` : e
          }</td>
        </tr>`
      })
      .join("")

    fenetre.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Rapport d'inventaire ${detail.reference}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; color: #111827; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .entreprise { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
            .meta { border: 1px solid #e5e7eb; padding: 12px; margin-bottom: 18px; font-size: 13px; }
            .meta div { margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; }
            th { background: #f3f4f6; text-align: left; }
            tfoot td { font-weight: bold; background: #f9fafb; }
            .signature { margin-top: 40px; font-size: 13px; }
            .signature p { margin: 18px 0; }
            .footer { margin-top: 30px; font-size: 11px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="entreprise">Société Monétique Tunisie</div>
          <h1>Rapport d'inventaire — ${detail.reference}</h1>
          <div class="meta">
            <div><strong>Banque :</strong> ${detail.bank?.name ?? ""} (${detail.bank?.code ?? ""})</div>
            <div><strong>Ouvert le :</strong> ${formatDateTime(detail.startedAt)} par ${
              detail.startedBy ? `${detail.startedBy.firstName} ${detail.startedBy.lastName}` : "-"
            }</div>
            <div><strong>Clôturé le :</strong> ${formatDateTime(detail.completedAt)}</div>
            <div><strong>Statut :</strong> ${LIBELLE_STATUT[detail.status] ?? detail.status}</div>
            <div><strong>Lignes comptées :</strong> ${synthese.comptees} / ${synthese.total}</div>
            <div><strong>Écarts constatés :</strong> ${synthese.ecarts} (${synthese.excedents} excédent(s), ${
              synthese.manquants
            } manquant(s))</div>
            ${detail.notes ? `<div><strong>Observations :</strong> ${detail.notes}</div>` : ""}
          </div>
          <table>
            <thead>
              <tr>
                <th>Emplacement</th><th>Carte</th><th>Type</th>
                <th style="text-align:right">Théorique</th>
                <th style="text-align:right">Compté</th>
                <th style="text-align:right">Écart</th>
              </tr>
            </thead>
            <tbody>${lignesHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total</td>
                <td style="text-align:right">${synthese.theorique}</td>
                <td style="text-align:right">${synthese.compte}</td>
                <td style="text-align:right">${synthese.compte - synthese.theorique}</td>
              </tr>
            </tfoot>
          </table>
          <div class="signature">
            <p>Nom et prénom : ______________________________</p>
            <p>Fonction : ______________________________</p>
            <p>Date : ______________________________</p>
            <p>Signature :</p>
          </div>
          <div class="footer">Adresse : Centre urbain Nord, Sana Center, bloc C – 1082, Tunis</div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `)
    fenetre.document.close()
  }

  // --- Rendu -----------------------------------------------------------------
  if (detail) {
    const enCours = detail.status === "in_progress"
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setDetail(null)} className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la liste
            </Button>
            <h2 className="text-2xl font-bold">{detail.reference}</h2>
            <p className="text-muted-foreground">
              {detail.bank?.name} — ouvert le {formatDateTime(detail.startedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={VARIANTE_STATUT[detail.status]}>{LIBELLE_STATUT[detail.status] ?? detail.status}</Badge>
            {!enCours && (
              <>
                <Button variant="outline" size="sm" onClick={imprimerRapport}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimer le rapport
                </Button>
                <Button variant="outline" size="sm" onClick={exporterCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { libelle: "Lignes comptées", valeur: `${synthese.comptees} / ${synthese.total}` },
            { libelle: "Quantité théorique", valeur: synthese.theorique },
            { libelle: "Quantité comptée", valeur: synthese.compte },
            { libelle: "Écarts", valeur: synthese.ecarts },
          ].map((carte) => (
            <Card key={carte.libelle}>
              <CardHeader className="pb-2">
                <CardDescription>{carte.libelle}</CardDescription>
                <CardTitle className="text-2xl">{carte.valeur}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{enCours ? "Saisie du comptage" : "Rapport d'inventaire"}</CardTitle>
            <CardDescription>
              {enCours
                ? "Renseignez la quantité réellement comptée pour chaque carte à chaque emplacement."
                : `${synthese.ecarts} écart(s) : ${synthese.excedents} excédent(s), ${synthese.manquants} manquant(s).`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emplacement</TableHead>
                    <TableHead>Carte</TableHead>
                    <TableHead className="text-right">Théorique</TableHead>
                    <TableHead className="text-right">Compté</TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignesDetail.map((ligne) => {
                    const saisie = saisies[ligne.id] ?? ""
                    const compteAffiche = enCours ? (saisie === "" ? null : Number(saisie)) : ligne.countedQuantity
                    const e = compteAffiche === null ? null : compteAffiche - ligne.expectedQuantity
                    return (
                      <TableRow key={ligne.id}>
                        <TableCell>{ligne.location?.name}</TableCell>
                        <TableCell>
                          <div className="font-medium">{ligne.card?.name}</div>
                          <div className="text-xs text-muted-foreground">{ligne.card?.type}</div>
                        </TableCell>
                        <TableCell className="text-right">{ligne.expectedQuantity}</TableCell>
                        <TableCell className="text-right">
                          {enCours ? (
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              className="ml-auto w-24 text-right"
                              aria-label={`Quantité comptée pour ${ligne.card?.name} à ${ligne.location?.name}`}
                              value={saisie}
                              onChange={(evenement) =>
                                setSaisies((prec) => ({ ...prec, [ligne.id]: evenement.target.value }))
                              }
                            />
                          ) : (
                            (ligne.countedQuantity ?? "-")
                          )}
                        </TableCell>
                        <TableCell
                          className={
                            "text-right font-medium " +
                            (e === null || e === 0 ? "" : e > 0 ? "text-emerald-600" : "text-destructive")
                          }
                        >
                          {e === null ? "-" : e > 0 ? `+${e}` : e}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {enCours && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={enregistrerComptage} disabled={enregistrement}>
                  {enregistrement ? "Enregistrement..." : "Enregistrer le comptage"}
                </Button>
                {estAdmin && (
                  <Button variant="secondary" onClick={() => setACloturer(detail)}>
                    Clôturer l'inventaire
                  </Button>
                )}
              </div>
            )}

            {detail.status === "completed" && estAdmin && (
              <div className="mt-4">
                <Button variant="destructive" onClick={() => setARegulariser(detail)}>
                  Régulariser le stock
                </Button>
                <p className="mt-2 text-sm text-muted-foreground">
                  Aligne le stock sur les quantités comptées et crée un mouvement par correction.
                </p>
              </div>
            )}

            {detail.status === "adjusted" && (
              <p className="mt-4 text-sm text-muted-foreground">
                Stock régularisé le {formatDateTime(detail.adjustedAt)}. Les corrections figurent dans l'historique
                des mouvements sous le motif « Régularisation inventaire {detail.reference} ».
              </p>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={aCloturer !== null} onOpenChange={(o) => !o && !action && setACloturer(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clôturer cet inventaire ?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>Les quantités comptées seront figées et ne pourront plus être modifiées.</p>
                  <p>Le stock n'est pas modifié à cette étape : la régularisation se fait ensuite, séparément.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={action}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={(evenement) => {
                  evenement.preventDefault()
                  cloturer()
                }}
                disabled={action}
              >
                {action ? "Clôture..." : "Clôturer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={aRegulariser !== null} onOpenChange={(o) => !o && !action && setARegulariser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Régulariser le stock ?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="font-medium text-destructive">
                    ⚠️ Cette action modifie le stock et n'est pas réversible.
                  </p>
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <div className="font-semibold">Effet sur le stock</div>
                    <p className="mt-1">
                      {synthese.ecarts} ligne(s) vont être corrigées : {synthese.excedents} excédent(s) et{" "}
                      {synthese.manquants} manquant(s). Le stock sera aligné sur les quantités comptées.
                    </p>
                  </div>
                  <p>
                    Un mouvement sera créé pour chaque correction, avec le motif « Régularisation inventaire{" "}
                    {detail.reference} », afin que l'historique reste vérifiable.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={action}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={(evenement) => {
                  evenement.preventDefault()
                  regulariser()
                }}
                disabled={action}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {action ? "Régularisation..." : "Régulariser le stock"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Inventaires</h2>
          <p className="text-muted-foreground">
            Campagnes de comptage physique par banque, avec rapport d'écarts et régularisation du stock.
          </p>
        </div>
        {estAdmin && (
          <Button onClick={() => setDialogueCreation(true)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Nouvel inventaire
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des inventaires</CardTitle>
          <CardDescription>{inventaires.length} inventaire(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {chargement ? (
            <p className="py-8 text-center text-muted-foreground">Chargement...</p>
          ) : inventaires.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Aucun inventaire pour le moment. Lancez-en un pour démarrer un comptage.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Banque</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Avancement</TableHead>
                    <TableHead className="text-right">Écarts</TableHead>
                    <TableHead>Ouvert le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventaires.map((inventaire) => (
                    <TableRow key={inventaire.id}>
                      <TableCell className="font-medium">{inventaire.reference}</TableCell>
                      <TableCell>{inventaire.bank?.name}</TableCell>
                      <TableCell>
                        <Badge variant={VARIANTE_STATUT[inventaire.status]}>
                          {LIBELLE_STATUT[inventaire.status] ?? inventaire.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {inventaire.countedLines} / {inventaire.totalLines}
                      </TableCell>
                      <TableCell className="text-right">
                        {inventaire.status === "in_progress" ? "-" : inventaire.discrepancyLines}
                      </TableCell>
                      <TableCell>{formatDateTime(inventaire.startedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => ouvrirDetail(inventaire)}>
                          {inventaire.status === "in_progress" ? "Compter" : "Rapport"}
                        </Button>
                        {estAdmin && inventaire.status !== "adjusted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setASupprimer(inventaire)}
                            aria-label={`Supprimer l'inventaire ${inventaire.reference}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogueCreation} onOpenChange={setDialogueCreation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel inventaire</DialogTitle>
            <DialogDescription>
              L'inventaire couvre toutes les cartes de la banque, à chacun de ses emplacements. Le stock théorique est
              figé à cet instant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inventaire-banque">Banque</Label>
              <Select value={banqueChoisie} onValueChange={setBanqueChoisie}>
                <SelectTrigger id="inventaire-banque">
                  <SelectValue placeholder="Choisir une banque" />
                </SelectTrigger>
                <SelectContent>
                  {banques.map((banque) => (
                    <SelectItem key={banque.id} value={banque.id}>
                      {banque.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventaire-notes">Observations (facultatif)</Label>
              <Textarea
                id="inventaire-notes"
                value={notes}
                onChange={(evenement) => setNotes(evenement.target.value)}
                placeholder="Équipe, contexte, consignes particulières..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogueCreation(false)} disabled={creation}>
              Annuler
            </Button>
            <Button onClick={creerInventaire} disabled={creation}>
              {creation ? "Ouverture..." : "Ouvrir l'inventaire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={aSupprimer !== null} onOpenChange={(o) => !o && !action && setASupprimer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet inventaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              {aSupprimer?.reference} sera supprimé avec toutes ses lignes de comptage. Le stock n'est pas modifié.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(evenement) => {
                evenement.preventDefault()
                supprimer()
              }}
              disabled={action}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {action ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
