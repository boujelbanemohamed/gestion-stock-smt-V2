import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import BanksManagement from "@/components/dashboard/banks-management"

const mockSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}))

// jsdom n'implémente pas ces APIs de pointeur utilisées par Radix Select.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const bankA = {
  id: "bank-1",
  name: "Banque Centrale",
  code: "B001",
  country: "Tunisie",
  swiftCode: "BCTNTNTT",
  address: "123 Avenue Habib Bourguiba",
  phone: "+216 71 123456",
  email: "contact@bc.tn",
  isActive: true,
}

function setupFetchMock(overrides: { importResponse?: unknown } = {}) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/api/banks/import" && options?.method === "POST") {
      return jsonResponse(overrides.importResponse ?? { success: true, errors: [] })
    }
    if (url.startsWith("/api/banks")) return jsonResponse({ success: true, data: [bankA] })
    if (url.startsWith("/api/locations")) return jsonResponse({ success: true, data: [] })
    if (url.startsWith("/api/cards")) return jsonResponse({ success: true, data: [] })
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const CSV_HEADER = "ID;CodeBanque;NomBanque;Pays;SwiftCode;Adresse;Telephone;Email"
const CSV_CONTENT = `${CSV_HEADER}\n;B002;Banque Zitouna;Tunisie;BZITTNTT;10 Rue de Rome;+216 71 999888;contact@zitouna.tn`

// jsdom ne fournit pas File.prototype.text() dans toutes les versions ;
// le composant l'utilise pour lire le CSV sélectionné.
function csvFile(content = CSV_CONTENT, name = "banques.csv") {
  const file = new File([content], name, { type: "text/csv" })
  if (typeof file.text !== "function") {
    Object.defineProperty(file, "text", { value: () => Promise.resolve(content) })
  }
  return file
}

async function openImportDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /^importer$/i }))
  return screen.getByRole("dialog")
}

describe("BanksManagement - import CSV", () => {
  beforeEach(() => {
    setupFetchMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("ouvre la boîte de dialogue d'import et garde le bouton Importer désactivé sans fichier", async () => {
    const user = userEvent.setup()
    render(<BanksManagement />)

    const dialog = await openImportDialog(user)
    expect(await screen.findByText("Importer des banques")).toBeInTheDocument()
    expect(screen.getByText(/CodeBanque;NomBanque;Pays/)).toBeInTheDocument()

    // Le bouton de confirmation (dans le pied de la boîte de dialogue) reste
    // désactivé tant qu'aucun fichier n'a été choisi.
    const confirmButton = within(dialog).getAllByRole("button", { name: /importer/i }).pop()!
    expect(confirmButton).toBeDisabled()
  })

  it("affiche le nom du fichier CSV sélectionné", async () => {
    const user = userEvent.setup()
    render(<BanksManagement />)
    await openImportDialog(user)

    await user.upload(screen.getByLabelText("Fichier CSV"), csvFile())

    expect(await screen.findByText("banques.csv")).toBeInTheDocument()
  })

  it("vide le champ fichier quand on ferme la boîte de dialogue", async () => {
    const user = userEvent.setup()
    render(<BanksManagement />)
    const dialog = await openImportDialog(user)

    const fileInput = screen.getByLabelText("Fichier CSV") as HTMLInputElement
    await user.upload(fileInput, csvFile())
    expect(fileInput.files).toHaveLength(1)
    expect(await screen.findByText("banques.csv")).toBeInTheDocument()

    // La réinitialisation passe par un ref sur <Input> : sans forwardRef, le ref
    // restait null et le champ conservait le fichier précédemment choisi.
    await user.click(within(dialog).getByRole("button", { name: /fermer/i }))

    expect(fileInput.value).toBe("")
    expect(fileInput.files).toHaveLength(0)
  })

  it("envoie les lignes du CSV analysées à l'API d'import", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<BanksManagement />)
    const dialog = await openImportDialog(user)

    await user.upload(screen.getByLabelText("Fichier CSV"), csvFile())
    const confirmButton = within(dialog).getAllByRole("button", { name: /importer/i }).pop()!
    await user.click(confirmButton)

    await waitFor(() => {
      const importCall = fetchMock.mock.calls.find((c) => c[0] === "/api/banks/import")
      expect(importCall).toBeTruthy()
    })
    const importCall = fetchMock.mock.calls.find((c) => c[0] === "/api/banks/import")!
    const body = JSON.parse((importCall[1] as RequestInit).body as string)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      CodeBanque: "B002",
      NomBanque: "Banque Zitouna",
      Pays: "Tunisie",
      SwiftCode: "BZITTNTT",
      Email: "contact@zitouna.tn",
    })
  })

  it("affiche les erreurs renvoyées par l'API d'import", async () => {
    setupFetchMock({
      importResponse: { success: false, errors: ["Ligne 2 : le code banque B002 existe déjà"] },
    })
    const user = userEvent.setup()
    render(<BanksManagement />)
    const dialog = await openImportDialog(user)

    await user.upload(screen.getByLabelText("Fichier CSV"), csvFile())
    const confirmButton = within(dialog).getAllByRole("button", { name: /importer/i }).pop()!
    await user.click(confirmButton)

    expect(await screen.findByText(/le code banque B002 existe déjà/)).toBeInTheDocument()
    expect(screen.getByText(/Erreurs détectées/)).toBeInTheDocument()
  })

  it("télécharge un modèle CSV avec les bons en-têtes", async () => {
    const user = userEvent.setup()
    let capturedBlob: Blob | undefined
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn((blob: Blob) => {
        capturedBlob = blob
        return "blob:mock-url"
      }),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    render(<BanksManagement />)
    await user.click(await screen.findByRole("button", { name: /template csv/i }))

    await waitFor(() => expect(capturedBlob).toBeDefined())
    const text = await blobText(capturedBlob!)
    expect(text).toContain(CSV_HEADER)
  })
})

async function blobText(blob: Blob): Promise<string> {
  if (typeof (blob as any).text === "function") return (blob as any).text()
  const buffer = await blob.arrayBuffer()
  return new TextDecoder("utf-8").decode(buffer)
}
