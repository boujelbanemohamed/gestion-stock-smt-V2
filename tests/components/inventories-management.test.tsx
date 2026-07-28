import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import InventoriesManagement from "@/components/dashboard/inventories-management"
import { Toaster } from "@/components/ui/toaster"

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

let mockHasPermission = (_module: string, _action: string) => true
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    user: { id: "admin-1", role: "admin" },
    permissions: [],
    hasPermission: (module: string, action: string) => mockHasPermission(module, action),
    hasAnyPermission: () => true,
    canAccessModule: () => true,
    isLoading: false,
  }),
}))

const exportToCsvMock = vi.fn()
vi.mock("@/lib/export", () => ({
  exportToCsv: (...args: unknown[]) => exportToCsvMock(...args),
  exportToExcel: vi.fn(),
}))

const banques = [{ id: "bank-1", name: "Amen Bank", code: "AMEN", isActive: true }]

const ligneA = {
  id: "line-1",
  inventoryId: "inv-1",
  cardId: "card-1",
  locationId: "loc-1",
  expectedQuantity: 100,
  countedQuantity: null,
  card: { id: "card-1", name: "Visa Classique", type: "Carte débit", subType: "S", subSubType: "N" },
  location: { id: "loc-1", name: "Coffre Tunis" },
}
const ligneB = {
  ...ligneA,
  id: "line-2",
  cardId: "card-2",
  locationId: "loc-2",
  expectedQuantity: 40,
  card: { id: "card-2", name: "Mastercard Gold", type: "Carte crédit", subType: "S", subSubType: "N" },
  location: { id: "loc-2", name: "Agence Sfax" },
}

function inventaire(over: Partial<any> = {}) {
  return {
    id: "inv-1",
    reference: "INV-20260728-AMEN-0900",
    bankId: "bank-1",
    status: "in_progress",
    startedAt: "2026-07-28T09:00:00.000Z",
    completedAt: null,
    adjustedAt: null,
    startedById: "admin-1",
    bank: { id: "bank-1", name: "Amen Bank", code: "AMEN", address: "Tunis" },
    startedBy: { id: "admin-1", firstName: "Admin", lastName: "Systeme", email: "a@a.tn" },
    totalLines: 2,
    countedLines: 0,
    discrepancyLines: 0,
    ...over,
  }
}

function setupFetchMock(liste: any[], detail: any) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/api/banks") return jsonResponse({ success: true, data: banques })
    if (url === "/api/inventories" && options?.method === "POST") {
      return jsonResponse({ success: true, data: { ...detail, totalLines: 2 } })
    }
    if (url === "/api/inventories") return jsonResponse({ success: true, data: liste })
    if (url.endsWith("/adjust")) {
      return jsonResponse({ success: true, data: detail, message: "Stock régularisé : 1 correction(s) appliquée(s)" })
    }
    if (url.endsWith("/complete")) {
      return jsonResponse({ success: true, data: detail, message: "Inventaire clôturé : 1 écart(s) constaté(s)" })
    }
    if (url.startsWith("/api/inventories/") && options?.method === "PUT") {
      return jsonResponse({ success: true, data: { ...detail, countedLines: 2 } })
    }
    if (url.startsWith("/api/inventories/")) return jsonResponse({ success: true, data: detail })
    return jsonResponse({ success: true, data: [] })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  mockHasPermission = () => true
  exportToCsvMock.mockClear()
  localStorage.setItem("accessToken", "jeton-de-test")
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("InventoriesManagement", () => {
  it("affiche la liste des inventaires avec leur avancement", async () => {
    setupFetchMock([inventaire({ countedLines: 1, totalLines: 2 })], inventaire())
    render(<InventoriesManagement />)

    expect(await screen.findByText("INV-20260728-AMEN-0900")).toBeInTheDocument()
    expect(screen.getByText("Amen Bank")).toBeInTheDocument()
    expect(screen.getByText("En cours")).toBeInTheDocument()
    expect(screen.getByText("1 / 2")).toBeInTheDocument()
  })

  // L'écart doit se calculer pendant la saisie, sans attendre l'enregistrement :
  // c'est ce qui permet à l'équipe de repérer une erreur de comptage tout de suite.
  it("calcule l'écart en direct pendant la saisie du comptage", async () => {
    setupFetchMock([inventaire()], inventaire({ lines: [ligneA, ligneB] }))
    const user = userEvent.setup()
    render(<InventoriesManagement />)

    await user.click(await screen.findByRole("button", { name: "Compter" }))

    const champ = await screen.findByLabelText(/Quantité comptée pour Visa Classique à Coffre Tunis/i)
    fireEvent.change(champ, { target: { value: "97" } })

    const lignes = screen.getAllByRole("row")
    const ligneVisa = lignes.find((l) => within(l).queryByText("Visa Classique"))!
    expect(within(ligneVisa).getByText("-3")).toBeInTheDocument()

    fireEvent.change(champ, { target: { value: "105" } })
    expect(within(ligneVisa).getByText("+5")).toBeInTheDocument()
  })

  it("envoie les quantités comptées à l'API, en laissant null les lignes non comptées", async () => {
    const fetchMock = setupFetchMock([inventaire()], inventaire({ lines: [ligneA, ligneB] }))
    const user = userEvent.setup()
    render(<InventoriesManagement />)

    await user.click(await screen.findByRole("button", { name: "Compter" }))
    const champ = await screen.findByLabelText(/Quantité comptée pour Visa Classique/i)
    fireEvent.change(champ, { target: { value: "97" } })

    await user.click(screen.getByRole("button", { name: /enregistrer le comptage/i }))

    await waitFor(() => {
      const appel = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "PUT")
      expect(appel).toBeTruthy()
    })
    const appel = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "PUT")!
    const corps = JSON.parse((appel[1] as RequestInit).body as string)
    expect(corps.lines).toEqual([
      { id: "line-1", countedQuantity: 97 },
      { id: "line-2", countedQuantity: null },
    ])
  })

  it("affiche le rapport d'un inventaire clôturé, avec le détail des écarts", async () => {
    const cloture = inventaire({
      status: "completed",
      completedAt: "2026-07-28T11:00:00.000Z",
      lines: [
        { ...ligneA, countedQuantity: 97 },
        { ...ligneB, countedQuantity: 46 },
      ],
    })
    setupFetchMock([cloture], cloture)
    const user = userEvent.setup()
    render(<InventoriesManagement />)

    await user.click(await screen.findByRole("button", { name: "Rapport" }))

    expect(await screen.findByText("Rapport d'inventaire")).toBeInTheDocument()
    expect(screen.getByText(/2 écart\(s\) : 1 excédent\(s\), 1 manquant\(s\)/i)).toBeInTheDocument()
    const lignes = screen.getAllByRole("row")
    expect(within(lignes.find((l) => within(l).queryByText("Visa Classique"))!).getByText("-3")).toBeInTheDocument()
    expect(within(lignes.find((l) => within(l).queryByText("Mastercard Gold"))!).getByText("+6")).toBeInTheDocument()
  })

  it("exporte le rapport en CSV avec une ligne par carte et emplacement", async () => {
    const cloture = inventaire({
      status: "completed",
      lines: [{ ...ligneA, countedQuantity: 97 }, { ...ligneB, countedQuantity: 40 }],
    })
    setupFetchMock([cloture], cloture)
    const user = userEvent.setup()
    render(<InventoriesManagement />)

    await user.click(await screen.findByRole("button", { name: "Rapport" }))
    await user.click(await screen.findByRole("button", { name: /export csv/i }))

    expect(exportToCsvMock).toHaveBeenCalledTimes(1)
    const [nom, entetes, lignes] = exportToCsvMock.mock.calls[0]
    expect(nom).toContain("INV-20260728-AMEN-0900")
    expect(entetes).toContain("Écart")
    expect(lignes).toEqual([
      ["Coffre Tunis", "Visa Classique", "Carte débit", 100, 97, -3],
      ["Agence Sfax", "Mastercard Gold", "Carte crédit", 40, 40, 0],
    ])
  })

  // La régularisation modifie le stock : l'utilisateur doit savoir ce qu'il
  // déclenche avant de confirmer.
  it("annonce l'effet sur le stock avant de régulariser, et n'appelle l'API qu'après confirmation", async () => {
    const cloture = inventaire({
      status: "completed",
      lines: [{ ...ligneA, countedQuantity: 97 }, { ...ligneB, countedQuantity: 46 }],
    })
    const fetchMock = setupFetchMock([cloture], cloture)
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <InventoriesManagement />
      </>,
    )

    await user.click(await screen.findByRole("button", { name: "Rapport" }))
    await user.click(await screen.findByRole("button", { name: /régulariser le stock/i }))

    const dialogue = await screen.findByRole("alertdialog")
    expect(within(dialogue).getByText("Effet sur le stock")).toBeInTheDocument()
    expect(
      within(dialogue).getByText(/2 ligne\(s\) vont être corrigées : 1 excédent\(s\) et 1 manquant\(s\)/i),
    ).toBeInTheDocument()
    // Rien n'est envoyé tant que l'utilisateur n'a pas confirmé.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/adjust"))).toBe(false)

    await user.click(within(dialogue).getByRole("button", { name: /^régulariser le stock$/i }))

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/adjust"))).toBe(true)
    })
  })

  it("masque les actions d'administration pour un utilisateur sans droit de suppression", async () => {
    mockHasPermission = (_module, action) => action !== "delete"
    setupFetchMock([inventaire()], inventaire())
    render(<InventoriesManagement />)

    await screen.findByText("INV-20260728-AMEN-0900")
    expect(screen.queryByRole("button", { name: /nouvel inventaire/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /supprimer l'inventaire/i })).not.toBeInTheDocument()
    // La consultation reste possible.
    expect(screen.getByRole("button", { name: "Compter" })).toBeInTheDocument()
  })
})
