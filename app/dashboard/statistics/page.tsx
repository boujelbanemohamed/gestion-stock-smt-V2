"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateRangePicker } from "@/components/dashboard/date-range-picker"
import type { DateRange } from "react-day-picker"
import type { Bank, Location } from "@/lib/types"
import { authenticatedFetch } from "@/lib/api-client"
import { exportToCsv, exportToExcel } from "@/lib/export"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { Calculator, TrendingUp, Printer, Download } from "lucide-react"

export default function StatisticsPage() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [allLocations, setAllLocations] = useState<Location[]>([])
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([])
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [filters, setFilters] = useState({
    bankId: "all",
    movementType: "all",
    fromLocationId: "all",
    toLocationId: "all",
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    quantiteDe: number
    quantiteVers: number
    total: number
    pourcentage: number
    fromLocationName: string | null
    toLocationName: string | null
    nombreMouvements: number
    statsByBank: Array<{
      bankId: string
      bankName: string
      bankCode: string
      quantiteDe: number
      quantiteVers: number
      total: number
      pourcentage: number
      statsByCardType: Array<{
        cardType: string
        quantiteDe: number
        quantiteVers: number
        total: number
        pourcentage: number
      }>
    }>
    detailsByDate: Array<{
      date: string
      bankId: string
      bankName: string
      bankCode: string
      movementType: string
      cardType: string
      quantiteDe: number
      quantiteVers: number
    }>
    totalDetailsDe: number
    totalDetailsVers: number
    filtres: any
  } | null>(null)

  useEffect(() => {
    loadBanks()
    loadAllLocations()
  }, [])

  // Filtrer les emplacements selon la banque sélectionnée
  useEffect(() => {
    if (filters.bankId === "all") {
      setFilteredLocations(allLocations)
    } else {
      const locationsForBank = allLocations.filter(loc => loc.bankId === filters.bankId)
      setFilteredLocations(locationsForBank)
    }
  }, [filters.bankId, allLocations])

  // Réinitialiser les sélections d'emplacements si elles ne sont plus valides après changement de banque
  useEffect(() => {
    if (filteredLocations.length > 0) {
      setFilters(prev => {
        const fromValid = prev.fromLocationId === "all" || filteredLocations.find(l => l.id === prev.fromLocationId)
        const toValid = prev.toLocationId === "all" || filteredLocations.find(l => l.id === prev.toLocationId)
        
        if (!fromValid || !toValid) {
          return {
            ...prev,
            fromLocationId: fromValid ? prev.fromLocationId : "all",
            toLocationId: toValid ? prev.toLocationId : "all",
          }
        }
        return prev
      })
    }
  }, [filteredLocations])

  const loadBanks = async () => {
    try {
      const response = await authenticatedFetch('/api/banks')
      const data = await response.json()
      if (data.success) {
        setBanks(data.data || [])
      }
    } catch (error) {
      console.error('Error loading banks:', error)
    }
  }

  const loadAllLocations = async () => {
    try {
      const response = await authenticatedFetch('/api/locations')
      const data = await response.json()
      if (data.success) {
        const locations = data.data || []
        setAllLocations(locations)
        setFilteredLocations(locations)
      }
    } catch (error) {
      console.error('Error loading locations:', error)
    }
  }

  const handleCalculate = async () => {
    // Validation : les emplacements De et Vers doivent être sélectionnés
    if (filters.fromLocationId === "all" || filters.toLocationId === "all") {
      toast({
        title: "Emplacements requis",
        description: "Sélectionnez les emplacements « De » et « Vers » pour effectuer le calcul.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await authenticatedFetch('/api/statistics/calculate', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: dateRange?.from ? dateRange.from.toISOString() : null,
          dateTo: dateRange?.to ? dateRange.to.toISOString() : null,
          bankId: filters.bankId !== "all" ? filters.bankId : null,
          movementType: filters.movementType !== "all" ? filters.movementType : null,
          fromLocationId: filters.fromLocationId !== "all" ? filters.fromLocationId : null,
          toLocationId: filters.toLocationId !== "all" ? filters.toLocationId : null,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setResult(data.data)
      } else {
        toast({ title: "Calcul impossible", description: data.error, variant: "destructive" })
        setResult(null)
      }
    } catch (error) {
      console.error('Error calculating statistics:', error)
      toast({
        title: "Calcul impossible",
        description: "Une erreur est survenue pendant le calcul des statistiques.",
        variant: "destructive",
      })
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setDateRange(undefined)
    setFilters({
      bankId: "all",
      movementType: "all",
      fromLocationId: "all",
      toLocationId: "all",
    })
    setResult(null)
  }

  const handlePrint = () => {
    if (!result) return

    // Récupérer le logo depuis la configuration
    const loadLogoAndPrint = async () => {
      try {
        const configResponse = await authenticatedFetch('/api/config')
        const configData = await configResponse.json()
        const logoPath = configData.success && configData.data?.companyLogo 
          ? configData.data.companyLogo 
          : null

        // Créer le contenu HTML pour l'impression
        const printContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Rapport de Statistiques</title>
              <style>
                @media print {
                  @page {
                    size: A4;
                    margin: 2cm;
                  }
                  body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                }
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  color: #333;
                }
                .header {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  margin-bottom: 30px;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #1e293b;
                }
                .logo-container {
                  display: flex;
                  align-items: center;
                  gap: 20px;
                }
                .logo-container img {
                  max-height: 80px;
                  max-width: 150px;
                  object-fit: contain;
                }
                .header-text {
                  text-align: right;
                }
                .company-name {
                  font-size: 24px;
                  font-weight: bold;
                  color: #1e293b;
                  margin-bottom: 5px;
                }
                .report-title {
                  font-size: 20px;
                  color: #64748b;
                  margin-bottom: 5px;
                }
                .date {
                  font-size: 14px;
                  color: #94a3b8;
                }
                .content {
                  margin-top: 30px;
                }
                .result-box {
                  text-align: center;
                  background: #f8fafc;
                  border: 2px solid #cbd5e1;
                  border-radius: 8px;
                  padding: 30px;
                  margin: 20px 0;
                }
                .percentage {
                  font-size: 48px;
                  font-weight: bold;
                  color: #2563eb;
                  margin: 10px 0;
                }
                .description {
                  font-size: 16px;
                  color: #64748b;
                  margin-top: 10px;
                }
                .details-grid {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 20px;
                  margin: 30px 0;
                }
                .detail-card {
                  background: white;
                  border: 1px solid #e2e8f0;
                  border-radius: 8px;
                  padding: 20px;
                  text-align: center;
                }
                .detail-label {
                  font-size: 14px;
                  color: #64748b;
                  margin-bottom: 10px;
                }
                .detail-name {
                  font-size: 18px;
                  font-weight: bold;
                  color: #1e293b;
                  margin-bottom: 10px;
                }
                .detail-value {
                  font-size: 32px;
                  font-weight: bold;
                  margin-top: 10px;
                }
                .value-blue {
                  color: #2563eb;
                }
                .value-green {
                  color: #16a34a;
                }
                .value-gray {
                  color: #1e293b;
                }
                .formula-box {
                  background: #eff6ff;
                  border: 1px solid #bfdbfe;
                  border-radius: 8px;
                  padding: 20px;
                  margin: 30px 0;
                }
                .formula-title {
                  font-size: 16px;
                  font-weight: bold;
                  color: #1e40af;
                  margin-bottom: 15px;
                }
                .formula-line {
                  font-family: 'Courier New', monospace;
                  font-size: 14px;
                  color: #1e40af;
                  margin: 5px 0;
                }
                .info-section {
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e2e8f0;
                  font-size: 14px;
                  color: #64748b;
                }
                .info-item {
                  margin: 5px 0;
                }
                .info-strong {
                  font-weight: bold;
                  color: #1e293b;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 20px 0;
                }
                th, td {
                  padding: 12px;
                  text-align: left;
                  border-bottom: 1px solid #e2e8f0;
                }
                th {
                  background: #f1f5f9;
                  font-weight: bold;
                  color: #1e293b;
                }
                .filters-table {
                  margin-top: 20px;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="logo-container">
                  ${logoPath ? `<img src="${logoPath}" alt="Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />` : ''}
                  <div style="display: ${logoPath ? 'none' : 'flex'}; width: 150px; height: 80px; background-color: #1e293b; color: white; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; border-radius: 4px;">
                    SMT
                  </div>
                </div>
                <div class="header-text">
                  <div class="company-name">Société Monétique Tunisie</div>
                  <div class="report-title">Rapport de Statistiques</div>
                  <div class="date">${new Date().toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</div>
                </div>
              </div>

              <div class="content">
                <div class="result-box">
                  <div class="percentage">${result.pourcentage.toFixed(2)}%</div>
                  <div class="description">
                    Pourcentage de <strong>${result.toLocationName || 'Emplacement Vers'}</strong> par rapport au total
                  </div>
                </div>

                <div class="details-grid">
                  <div class="detail-card">
                    <div class="detail-label">Quantité De</div>
                    <div class="detail-name">${result.fromLocationName || 'Emplacement De'}</div>
                    <div class="detail-value value-blue">${result.quantiteDe.toLocaleString()}</div>
                  </div>
                  <div class="detail-card">
                    <div class="detail-label">Quantité Vers</div>
                    <div class="detail-name">${result.toLocationName || 'Emplacement Vers'}</div>
                    <div class="detail-value value-green">${result.quantiteVers.toLocaleString()}</div>
                  </div>
                  <div class="detail-card">
                    <div class="detail-label">Total</div>
                    <div class="detail-name">(De + Vers)</div>
                    <div class="detail-value value-gray">${result.total.toLocaleString()}</div>
                  </div>
                </div>

                <div class="formula-box">
                  <div class="formula-title">Formule de calcul :</div>
                  <div class="formula-line">Pourcentage = (Quantité Vers / (Quantité Vers + Quantité De)) × 100</div>
                  <div class="formula-line">= (${result.quantiteVers.toLocaleString()} / ${result.total.toLocaleString()}) × 100</div>
                  <div class="formula-line">= ${result.pourcentage.toFixed(2)}%</div>
                </div>

                <div class="info-section">
                  <div class="info-item">
                    Nombre de mouvements analysés : <span class="info-strong">${result.nombreMouvements}</span>
                  </div>
                  ${result.filtres.dateFrom && result.filtres.dateTo ? `
                    <div class="info-item">
                      Période : <span class="info-strong">du ${new Date(result.filtres.dateFrom).toLocaleDateString('fr-FR')} au ${new Date(result.filtres.dateTo).toLocaleDateString('fr-FR')}</span>
                    </div>
                  ` : ''}
                  ${result.filtres.movementType && result.filtres.movementType !== 'all' ? `
                    <div class="info-item">
                      Type de mouvement : <span class="info-strong">${
                        result.filtres.movementType === 'entry' ? 'Entrée' : 
                        result.filtres.movementType === 'exit' ? 'Sortie' : 
                        'Transfert'
                      }</span>
                    </div>
                  ` : ''}
                </div>

                ${result.statsByBank && result.statsByBank.length > 0 ? `
                  <div style="margin-top: 40px; page-break-before: auto;">
                    <h2 style="font-size: 20px; font-weight: bold; color: #1e293b; margin-bottom: 20px; border-bottom: 2px solid #1e293b; padding-bottom: 10px;">
                      Détails par banque
                    </h2>
                    ${result.statsByBank.map(bankStat => `
                      <div style="margin-bottom: 30px; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 20px; background: white;">
                        <h3 style="font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 15px;">
                          ${bankStat.bankName} (${bankStat.bankCode})
                        </h3>
                        
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 6px;">
                          <div>
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">Quantité De</div>
                            <div style="font-size: 18px; font-weight: bold; color: #2563eb;">${bankStat.quantiteDe.toLocaleString()}</div>
                          </div>
                          <div>
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">Quantité Vers</div>
                            <div style="font-size: 18px; font-weight: bold; color: #16a34a;">${bankStat.quantiteVers.toLocaleString()}</div>
                          </div>
                          <div>
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">Total</div>
                            <div style="font-size: 18px; font-weight: bold; color: #1e293b;">${bankStat.total.toLocaleString()}</div>
                          </div>
                          <div>
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">Pourcentage</div>
                            <div style="font-size: 18px; font-weight: bold; color: #9333ea;">${bankStat.pourcentage.toFixed(2)}%</div>
                          </div>
                        </div>

                        ${bankStat.statsByCardType && bankStat.statsByCardType.length > 0 ? `
                          <div style="margin-top: 20px;">
                            <h4 style="font-size: 14px; font-weight: bold; color: #475569; margin-bottom: 10px;">Par type de carte :</h4>
                            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                              <thead>
                                <tr style="background: #f1f5f9;">
                                  <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Type de carte</th>
                                  <th style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Quantité De</th>
                                  <th style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Quantité Vers</th>
                                  <th style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Total</th>
                                  <th style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Pourcentage</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${bankStat.statsByCardType.map((cardStat, idx) => `
                                  <tr style="${idx % 2 === 0 ? 'background: white;' : 'background: #f8fafc;'}">
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 500; color: #1e293b;">${cardStat.cardType}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #2563eb;">${cardStat.quantiteDe.toLocaleString()}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #16a34a;">${cardStat.quantiteVers.toLocaleString()}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #1e293b;">${cardStat.total.toLocaleString()}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #9333ea;">${cardStat.pourcentage.toFixed(2)}%</td>
                                  </tr>
                                `).join('')}
                              </tbody>
                            </table>
                          </div>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                ` : ''}

                ${result.detailsByDate && result.detailsByDate.length > 0 ? `
                  <div style="margin-top: 40px; page-break-before: auto;">
                    <h2 style="font-size: 20px; font-weight: bold; color: #1e293b; margin-bottom: 20px; border-bottom: 2px solid #1e293b; padding-bottom: 10px;">
                      Détails par date, banque, type de mouvement et type de carte
                    </h2>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #cbd5e1;">
                      <thead>
                        <tr style="background: #f1f5f9;">
                          <th style="padding: 12px; text-align: left; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Date</th>
                          <th style="padding: 12px; text-align: left; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Banque</th>
                          <th style="padding: 12px; text-align: left; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Type de mouvement</th>
                          <th style="padding: 12px; text-align: left; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Type de carte</th>
                          <th style="padding: 12px; text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Quantité De</th>
                          <th style="padding: 12px; text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Quantité Vers</th>
                          <th style="padding: 12px; text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #1e293b;">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${result.detailsByDate.map((detail, idx) => `
                          <tr style="${idx % 2 === 0 ? 'background: white;' : 'background: #f8fafc;'}">
                            <td style="padding: 10px; border: 1px solid #e2e8f0;">${new Date(detail.date).toLocaleDateString('fr-FR')}</td>
                            <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 500; color: #1e293b;">${detail.bankName} (${detail.bankCode})</td>
                            <td style="padding: 10px; border: 1px solid #e2e8f0;">${detail.movementType}</td>
                            <td style="padding: 10px; border: 1px solid #e2e8f0;">${detail.cardType}</td>
                            <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; color: #2563eb;">${detail.quantiteDe.toLocaleString()}</td>
                            <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; color: #16a34a;">${detail.quantiteVers.toLocaleString()}</td>
                            <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #1e293b;">${(detail.quantiteDe + detail.quantiteVers).toLocaleString()}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                      <tfoot>
                        <tr style="background: #e2e8f0; font-weight: bold;">
                          <td colspan="4" style="padding: 12px; border: 1px solid #cbd5e1; text-align: right;">
                            TOTAUX :
                          </td>
                          <td style="padding: 12px; border: 1px solid #cbd5e1; text-align: right; color: #2563eb;">
                            ${result.totalDetailsDe.toLocaleString()}
                          </td>
                          <td style="padding: 12px; border: 1px solid #cbd5e1; text-align: right; color: #16a34a;">
                            ${result.totalDetailsVers.toLocaleString()}
                          </td>
                          <td style="padding: 12px; border: 1px solid #cbd5e1; text-align: right; color: #1e293b;">
                            ${(result.totalDetailsDe + result.totalDetailsVers).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ` : ''}
              </div>
            </body>
          </html>
        `

        // Ouvrir une nouvelle fenêtre pour l'impression
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(printContent)
          printWindow.document.close()
          
          // Attendre que le contenu soit chargé, puis imprimer
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print()
            }, 250)
          }
        }
      } catch (error) {
        console.error('Error loading config for print:', error)
        toast({
          title: "Impression impossible",
          description: "La configuration nécessaire à l'impression n'a pas pu être chargée.",
          variant: "destructive",
        })
      }
    }

    loadLogoAndPrint()
  }

  const handleExport = async (format: "csv" | "excel") => {
    if (!result) return

    const summaryHeaders = ["Indicateur", "Valeur"]
    const summaryRows: (string | number)[][] = [
      ["Emplacement De", result.fromLocationName || "-"],
      ["Quantité De", result.quantiteDe],
      ["Emplacement Vers", result.toLocationName || "-"],
      ["Quantité Vers", result.quantiteVers],
      ["Total (De + Vers)", result.total],
      ["Pourcentage", `${result.pourcentage.toFixed(2)}%`],
      ["Nombre de mouvements analysés", result.nombreMouvements],
      ...(result.filtres.dateFrom && result.filtres.dateTo
        ? [["Période", `du ${new Date(result.filtres.dateFrom).toLocaleDateString('fr-FR')} au ${new Date(result.filtres.dateTo).toLocaleDateString('fr-FR')}`]]
        : []),
    ]

    const detailsHeaders = ["Date", "Banque", "Code banque", "Type de mouvement", "Type de carte", "Quantité De", "Quantité Vers", "Total"]
    const detailsRows: (string | number)[][] = (result.detailsByDate || []).map((detail) => [
      new Date(detail.date).toLocaleDateString('fr-FR'),
      detail.bankName,
      detail.bankCode,
      detail.movementType,
      detail.cardType,
      detail.quantiteDe,
      detail.quantiteVers,
      detail.quantiteDe + detail.quantiteVers,
    ])

    const filename = `statistiques_${new Date().toISOString().slice(0, 10)}`

    if (format === "csv") {
      // Le CSV ne supporte qu'une seule table : on exporte le détail, le plus utile pour retraitement.
      exportToCsv(filename, detailsHeaders, detailsRows)
    } else {
      await exportToExcel(filename, [
        { name: "Résumé", headers: summaryHeaders, rows: summaryRows },
        { name: "Détails", headers: detailsHeaders, rows: detailsRows },
      ])
    }
    toast({
      title: "Export réussi",
      description: "Les statistiques ont été exportées avec succès.",
      variant: "success",
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Calcul de Statistiques
          </CardTitle>
          <CardDescription className="text-xs text-[#008DA8]">
            Calculez le pourcentage de la quantité de l'emplacement De par rapport au total (De + Vers)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtres */}
          <div className="space-y-6 mb-6">
            {/* Période */}
            <div className="space-y-2">
              <Label>Période</Label>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                className="w-full"
              />
            </div>

            {/* Banque */}
            <div className="space-y-2">
              <Label htmlFor="bank">Banque</Label>
              <Select
                value={filters.bankId}
                onValueChange={(value) => {
                  // Réinitialiser les emplacements lors du changement de banque
                  setFilters({ 
                    bankId: value, 
                    movementType: filters.movementType,
                    fromLocationId: "all",
                    toLocationId: "all",
                  })
                }}
              >
                <SelectTrigger id="bank">
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

            {/* Type de mouvement */}
            <div className="space-y-2">
              <Label htmlFor="movementType">Type de mouvement</Label>
              <Select
                value={filters.movementType}
                onValueChange={(value) => setFilters({ ...filters, movementType: value })}
              >
                <SelectTrigger id="movementType">
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

            {/* Emplacement De */}
            <div className="space-y-2">
              <Label htmlFor="fromLocation">Emplacement De *</Label>
              <Select
                value={filters.fromLocationId}
                onValueChange={(value) => setFilters({ ...filters, fromLocationId: value })}
              >
                <SelectTrigger id="fromLocation">
                  <SelectValue placeholder="Sélectionner un emplacement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les emplacements</SelectItem>
                  {filteredLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.bankId !== "all" && filteredLocations.length === 0 && (
                <p className="text-sm text-amber-600">Aucun emplacement disponible pour cette banque</p>
              )}
            </div>

            {/* Emplacement Vers */}
            <div className="space-y-2">
              <Label htmlFor="toLocation">Emplacement Vers *</Label>
              <Select
                value={filters.toLocationId}
                onValueChange={(value) => setFilters({ ...filters, toLocationId: value })}
              >
                <SelectTrigger id="toLocation">
                  <SelectValue placeholder="Sélectionner un emplacement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les emplacements</SelectItem>
                  {filteredLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.bankId !== "all" && filteredLocations.length === 0 && (
                <p className="text-sm text-amber-600">Aucun emplacement disponible pour cette banque</p>
              )}
            </div>

            {/* Boutons */}
            <div className="flex gap-4">
              <Button
                onClick={handleCalculate}
                disabled={loading || filters.fromLocationId === "all" || filters.toLocationId === "all"}
                className="flex items-center gap-2"
              >
                <Calculator className="h-4 w-4" />
                {loading ? "Calcul en cours..." : "Calculer"}
              </Button>
              <Button variant="outline" onClick={resetFilters}>
                Réinitialiser
              </Button>
            </div>
          </div>

          {/* Résultats */}
          {result && (
            <Card className="bg-slate-50 border-2 border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Résultats du Calcul</CardTitle>
                    <CardDescription>
                      Pourcentage calculé sur la période sélectionnée
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handlePrint}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimer
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Exporter
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport("csv")}>
                          Exporter en CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport("excel")}>
                          Exporter en Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Pourcentage principal */}
                  <div className="text-center p-6 bg-white rounded-lg border border-slate-200">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {result.pourcentage.toFixed(2)}%
                    </div>
                    <div className="text-sm text-slate-600">
                      {result.fromLocationName && result.toLocationName && (
                        <>
                          Pourcentage de <strong>{result.toLocationName}</strong> par rapport au total
                        </>
                      )}
                    </div>
                  </div>

                  {/* Détails */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Quantité De</div>
                      <div className="text-2xl font-bold">
                        {result.fromLocationName || "Emplacement De"}
                      </div>
                      <div className="text-3xl font-bold text-blue-600 mt-2">
                        {result.quantiteDe.toLocaleString()}
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Quantité Vers</div>
                      <div className="text-2xl font-bold">
                        {result.toLocationName || "Emplacement Vers"}
                      </div>
                      <div className="text-3xl font-bold text-green-600 mt-2">
                        {result.quantiteVers.toLocaleString()}
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Total</div>
                      <div className="text-2xl font-bold text-slate-700">
                        (De + Vers)
                      </div>
                      <div className="text-3xl font-bold text-slate-800 mt-2">
                        {result.total.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Formule */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm font-semibold text-blue-900 mb-2">Formule de calcul :</div>
                    <div className="text-sm text-blue-800 font-mono">
                      Pourcentage = (Quantité Vers / (Quantité Vers + Quantité De)) × 100
                    </div>
                    <div className="text-sm text-blue-800 font-mono mt-2">
                      = ({result.quantiteVers.toLocaleString()} / {result.total.toLocaleString()}) × 100
                    </div>
                    <div className="text-sm text-blue-800 font-mono mt-2">
                      = {result.pourcentage.toFixed(2)}%
                    </div>
                  </div>

                  {/* Informations supplémentaires */}
                  <div className="text-sm text-slate-600 mb-6">
                    <div>Nombre de mouvements analysés : <strong>{result.nombreMouvements}</strong></div>
                    {result.filtres.dateFrom && result.filtres.dateTo && (
                      <div>
                        Période : du {new Date(result.filtres.dateFrom).toLocaleDateString('fr-FR')} au {new Date(result.filtres.dateTo).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </div>

                  {/* Détails par banque */}
                  {result.statsByBank && result.statsByBank.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Détails par banque</h3>
                      {result.statsByBank.map((bankStat) => (
                        <Card key={bankStat.bankId} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                              {bankStat.bankName} ({bankStat.bankCode})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {/* Résumé de la banque */}
                              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg sm:grid-cols-4">
                                <div>
                                  <div className="text-xs text-slate-600">Quantité De</div>
                                  <div className="text-lg font-bold text-blue-600">{bankStat.quantiteDe.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-600">Quantité Vers</div>
                                  <div className="text-lg font-bold text-green-600">{bankStat.quantiteVers.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-600">Total</div>
                                  <div className="text-lg font-bold text-slate-800">{bankStat.total.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-600">Pourcentage</div>
                                  <div className="text-lg font-bold text-purple-600">{bankStat.pourcentage.toFixed(2)}%</div>
                                </div>
                              </div>

                              {/* Détails par type de carte */}
                              {bankStat.statsByCardType && bankStat.statsByCardType.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold text-slate-700">Par type de carte :</h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100">
                                          <th className="p-2 text-left border border-slate-300">Type de carte</th>
                                          <th className="p-2 text-center border border-slate-300">Quantité De</th>
                                          <th className="p-2 text-center border border-slate-300">Quantité Vers</th>
                                          <th className="p-2 text-center border border-slate-300">Total</th>
                                          <th className="p-2 text-center border border-slate-300">Pourcentage</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {bankStat.statsByCardType.map((cardStat, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-2 border border-slate-200 font-medium">{cardStat.cardType}</td>
                                            <td className="p-2 border border-slate-200 text-center text-blue-600">{cardStat.quantiteDe.toLocaleString()}</td>
                                            <td className="p-2 border border-slate-200 text-center text-green-600">{cardStat.quantiteVers.toLocaleString()}</td>
                                            <td className="p-2 border border-slate-200 text-center font-semibold">{cardStat.total.toLocaleString()}</td>
                                            <td className="p-2 border border-slate-200 text-center font-bold text-purple-600">{cardStat.pourcentage.toFixed(2)}%</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Tableau détaillé par date, banque, type de mouvement et type de carte */}
                  {result.detailsByDate && result.detailsByDate.length > 0 && (
                    <div className="space-y-4 mt-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">
                        Détails par date, banque, type de mouvement et type de carte
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse border border-slate-300">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="p-3 text-left border border-slate-300 font-semibold">Date</th>
                              <th className="p-3 text-left border border-slate-300 font-semibold">Banque</th>
                              <th className="p-3 text-left border border-slate-300 font-semibold">Type de mouvement</th>
                              <th className="p-3 text-left border border-slate-300 font-semibold">Type de carte</th>
                              <th className="p-3 text-right border border-slate-300 font-semibold">Quantité De</th>
                              <th className="p-3 text-right border border-slate-300 font-semibold">Quantité Vers</th>
                              <th className="p-3 text-right border border-slate-300 font-semibold">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.detailsByDate.map((detail, idx) => (
                              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                <td className="p-3 border border-slate-200">
                                  {new Date(detail.date).toLocaleDateString('fr-FR')}
                                </td>
                                <td className="p-3 border border-slate-200 font-medium">
                                  {detail.bankName} ({detail.bankCode})
                                </td>
                                <td className="p-3 border border-slate-200">{detail.movementType}</td>
                                <td className="p-3 border border-slate-200">{detail.cardType}</td>
                                <td className="p-3 border border-slate-200 text-right text-blue-600 font-medium">
                                  {detail.quantiteDe.toLocaleString()}
                                </td>
                                <td className="p-3 border border-slate-200 text-right text-green-600 font-medium">
                                  {detail.quantiteVers.toLocaleString()}
                                </td>
                                <td className="p-3 border border-slate-200 text-right font-semibold">
                                  {(detail.quantiteDe + detail.quantiteVers).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-200 font-bold">
                              <td colSpan={4} className="p-3 border border-slate-300 text-right">
                                TOTAUX :
                              </td>
                              <td className="p-3 border border-slate-300 text-right text-blue-600">
                                {result.totalDetailsDe.toLocaleString()}
                              </td>
                              <td className="p-3 border border-slate-300 text-right text-green-600">
                                {result.totalDetailsVers.toLocaleString()}
                              </td>
                              <td className="p-3 border border-slate-300 text-right">
                                {(result.totalDetailsDe + result.totalDetailsVers).toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

