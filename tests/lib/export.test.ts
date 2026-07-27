import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { exportToCsv } from "@/lib/export"

async function blobText(blob: Blob): Promise<string> {
  // jsdom's Blob exposes .text(); fall back to arrayBuffer + TextDecoder if absent.
  if (typeof (blob as any).text === "function") return (blob as any).text()
  const buffer = await blob.arrayBuffer()
  return new TextDecoder("utf-8").decode(buffer)
}

describe("exportToCsv", () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let capturedBlob: Blob | undefined

  beforeEach(() => {
    capturedBlob = undefined
    createObjectURLSpy = vi.fn((blob: Blob) => {
      capturedBlob = blob
      return "blob:mock-url"
    })
    // jsdom ne fournit pas nativement URL.createObjectURL/revokeObjectURL.
    vi.stubGlobal("URL", { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: vi.fn() })
    // Empêche jsdom de tenter une vraie navigation lors du link.click() simulé.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("génère un CSV avec un en-tête BOM UTF-8 et les bonnes colonnes", async () => {
    exportToCsv("mouvements", ["Date", "Type", "Quantité"], [["2026-01-01", "Entrée", 10]])

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)

    // Le BOM UTF-8 (EF BB BF) doit être présent dans les octets bruts du fichier,
    // condition pour qu'Excel affiche correctement les accents. Un décodeur texte
    // standard le retire à la lecture, il faut donc vérifier les octets, pas la chaîne décodée.
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])

    const content = await blobText(capturedBlob!)
    expect(content).toContain("Date,Type,Quantité")
    expect(content).toContain("2026-01-01,Entrée,10")
  })

  it("échappe les cellules contenant une virgule ou des guillemets", async () => {
    exportToCsv("test", ["Motif"], [['Transfert, "urgent"']])

    const content = await blobText(capturedBlob!)
    expect(content).toContain('"Transfert, ""urgent"""')
  })

  it("déclenche le téléchargement avec l'extension .csv", async () => {
    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === "a") el.click = clickSpy
      return el
    })

    exportToCsv("rapport-mouvements", ["Col"], [["val"]])

    const anchor = createElementSpy.mock.results[0]?.value as HTMLAnchorElement
    expect(anchor.download).toBe("rapport-mouvements.csv")
    expect(clickSpy).toHaveBeenCalledTimes(1)

    createElementSpy.mockRestore()
  })
})
