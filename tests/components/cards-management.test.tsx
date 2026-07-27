import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CardsManagement from "@/components/dashboard/cards-management"

// jsdom n'implémente pas ces APIs de pointeur utilisées par Radix Select.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const bankA = { id: "bank-1", name: "Banque Centrale", isActive: true }

const cardA = {
  id: "card-1",
  name: "Carte Débit Standard",
  type: "Visa",
  subType: "National",
  subSubType: "Standard",
  bankId: "bank-1",
  quantity: 100,
  minThreshold: 50,
  maxThreshold: 1000,
  isActive: true,
  bank: bankA,
  stockLevels: [],
}

function setupFetchMock(cards: any[] = [cardA]) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.startsWith("/api/cards/") && options?.method === "PUT") {
      return jsonResponse({ success: true, data: { ...cardA } })
    }
    if (url.startsWith("/api/cards/") && options?.method === "DELETE") {
      return jsonResponse({ success: true })
    }
    if (url === "/api/cards" && options?.method === "POST") {
      return jsonResponse({ success: true, data: { ...cardA, id: "card-2" } })
    }
    if (url.startsWith("/api/cards")) {
      return jsonResponse({ success: true, data: cards })
    }
    if (url.startsWith("/api/banks")) {
      return jsonResponse({ success: true, data: [bankA] })
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

async function expandBankGroup(user: ReturnType<typeof userEvent.setup>, bankName: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(bankName) }))
}

// Le SelectTrigger de Radix n'expose pas le placeholder dans son nom
// accessible : on cible donc les deux comboboxes du formulaire (banque,
// puis type) par leur position dans la boîte de dialogue ouverte.
async function selectBankAndType(user: ReturnType<typeof userEvent.setup>, bankName: string, type: string) {
  const dialog = screen.getByRole("dialog")
  const [bankCombo, typeCombo] = within(dialog).getAllByRole("combobox")

  await user.click(bankCombo)
  await user.click(await screen.findByRole("option", { name: bankName }))

  await user.click(typeCombo)
  await user.click(await screen.findByRole("option", { name: type }))
}

describe("CardsManagement", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("charge et affiche la liste des cartes groupées par banque", async () => {
    setupFetchMock()
    render(<CardsManagement />)

    expect(await screen.findByText(/carte\(s\) au total/)).toBeInTheDocument()
    expect(screen.getByText(/1 carte\(s\) au total/)).toBeInTheDocument()
  })

  it("affiche un message quand aucune carte ne correspond", async () => {
    setupFetchMock([])
    render(<CardsManagement />)

    expect(await screen.findByText("Aucune carte trouvée")).toBeInTheDocument()
  })

  it("refuse la soumission si le seuil minimum est supérieur ou égal au seuil maximum", async () => {
    setupFetchMock()
    const user = userEvent.setup()
    render(<CardsManagement />)
    await screen.findByText(/carte\(s\) au total/)

    await user.click(screen.getByRole("button", { name: /ajouter une carte/i }))

    await selectBankAndType(user, "Banque Centrale", "Visa")
    await user.type(screen.getByLabelText(/^nom/i), "Carte Débit Gold")
    await user.type(screen.getByLabelText(/^sous-type$/i), "International")
    await user.type(screen.getByLabelText(/sous-sous-type/i), "Gold")

    const maxInput = screen.getByLabelText(/seuil max/i)
    await user.clear(maxInput)
    await user.type(maxInput, "10")

    await user.click(screen.getByRole("button", { name: "Ajouter" }))

    expect(
      await screen.findByText("Le seuil minimum doit être inférieur au seuil maximum"),
    ).toBeInTheDocument()
  })

  it("crée une nouvelle carte avec une banque et un type sélectionnés", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<CardsManagement />)
    await screen.findByText(/carte\(s\) au total/)

    await user.click(screen.getByRole("button", { name: /ajouter une carte/i }))

    await selectBankAndType(user, "Banque Centrale", "Visa")

    await user.type(screen.getByLabelText(/^nom/i), "Carte Débit Gold")
    await user.type(screen.getByLabelText(/^sous-type$/i), "International")
    await user.type(screen.getByLabelText(/sous-sous-type/i), "Gold")

    await user.click(screen.getByRole("button", { name: "Ajouter" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/cards", expect.objectContaining({ method: "POST" }))
    })
  })

  it("pré-remplit le formulaire d'édition et envoie la mise à jour", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<CardsManagement />)
    await screen.findByText(/carte\(s\) au total/)

    await expandBankGroup(user, "Banque Centrale")
    await user.click(await screen.findByRole("button", { name: /modifier/i }))

    expect(await screen.findByDisplayValue("Carte Débit Standard")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Modifier" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/cards/${cardA.id}`,
        expect.objectContaining({ method: "PUT" }),
      )
    })
  })

  it("empêche la suppression d'une carte qui a encore du stock", async () => {
    const fetchMock = setupFetchMock([{ ...cardA, stockLevels: [{ id: "sl1", locationId: "loc-1", quantity: 5 }] }])
    vi.spyOn(window, "alert").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<CardsManagement />)
    await screen.findByText(/carte\(s\) au total/)

    await expandBankGroup(user, "Banque Centrale")
    await user.click(await screen.findByRole("button", { name: /supprimer/i }))

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Impossible de supprimer cette carte"))
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining(`/api/cards/${cardA.id}`),
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("supprime une carte sans stock après confirmation", async () => {
    const fetchMock = setupFetchMock()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.spyOn(window, "alert").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<CardsManagement />)
    await screen.findByText(/carte\(s\) au total/)

    await expandBankGroup(user, "Banque Centrale")
    await user.click(await screen.findByRole("button", { name: /supprimer/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/cards/${cardA.id}`,
        expect.objectContaining({ method: "DELETE" }),
      )
    })
  })
})
