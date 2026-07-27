// Utilitaires d'export CSV / Excel, génération entièrement côté client (aucune route API requise).

type CellValue = string | number

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escapeCsvCell(value: CellValue): string {
  const str = String(value ?? "")
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Exporte un tableau de lignes en CSV (UTF-8 avec BOM pour un affichage correct des accents dans Excel).
 */
export function exportToCsv(filename: string, headers: string[], rows: CellValue[][]) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","))
  const csvContent = "﻿" + lines.join("\r\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  triggerDownload(blob, `${filename}.csv`)
}

/**
 * Exporte un ou plusieurs onglets en fichier Excel (.xlsx) réel via la librairie xlsx (SheetJS).
 */
export async function exportToExcel(
  filename: string,
  sheets: Array<{ name: string; headers: string[]; rows: CellValue[][] }>,
) {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows])
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31))
  }

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  const blob = new Blob([buffer], { type: "application/octet-stream" })
  triggerDownload(blob, `${filename}.xlsx`)
}
