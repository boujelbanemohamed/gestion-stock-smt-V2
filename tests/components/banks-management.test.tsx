import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import BanksManagement from "@/components/dashboard/banks-management"
import { annulerConfirmation, repondreConfirmation } from "../helpers/dialogue-confirmation"

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
  // Format acceptable par la regex de validation du composant (au plus deux
  // séparateurs, groupe final de chiffres uniquement).
  phone: "+216 71 123456",
  email: "contact@bc.tn",
  isActive: true,
}

function setupFetchMock(banks: any[] = [bankA]) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.startsWith("/api/banks/") && options?.method === "PUT") {
      return jsonResponse({ success: true, data: { ...bankA } })
    }
    if (url.startsWith("/api/banks/") && options?.method === "DELETE") {
      return jsonResponse({ success: true })
    }
    if (url === "/api/banks" && options?.method === "POST") {
      return jsonResponse({ success: true, data: { ...bankA, id: "bank-2" } })
    }
    if (url.startsWith("/api/banks")) {
      return jsonResponse({ success: true, data: banks })
    }
    if (url.startsWith("/api/locations")) {
      return jsonResponse({ success: true, data: [] })
    }
    if (url.startsWith("/api/cards")) {
      return jsonResponse({ success: true, data: [] })
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("BanksManagement", () => {
  beforeEach(() => {
    mockSearchParams.delete("q")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("charge et affiche la liste des banques", async () => {
    setupFetchMock()
    render(<BanksManagement />)

    expect(await screen.findByText("Banque Centrale")).toBeInTheDocument()
    expect(screen.getByText(/1 banque trouvée/)).toBeInTheDocument()
  })

  it("affiche un message quand aucune banque ne correspond", async () => {
    setupFetchMock([])
    render(<BanksManagement />)

    expect(await screen.findByText("Aucune banque trouvée")).toBeInTheDocument()
  })

  it("refuse la soumission si le format du téléphone est invalide", async () => {
    setupFetchMock()
    const user = userEvent.setup()
    render(<BanksManagement />)
    await screen.findByText("Banque Centrale")

    await user.click(screen.getByRole("button", { name: /ajouter une banque/i }))
    await user.type(screen.getByLabelText(/^nom \*/i), "Banque Internationale")
    await user.type(screen.getByLabelText(/^code \*/i), "B002")
    await user.type(screen.getByLabelText(/^pays \*/i), "France")
    await user.type(screen.getByLabelText(/^adresse \*/i), "45 Rue de la Paix")
    await user.type(screen.getByLabelText(/^téléphone \*/i), "abc")

    await user.click(screen.getByRole("button", { name: "Ajouter" }))

    expect(await screen.findByText("Le format du numéro de téléphone est invalide")).toBeInTheDocument()
  })

  it("crée une nouvelle banque avec des données valides", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<BanksManagement />)
    await screen.findByText("Banque Centrale")

    await user.click(screen.getByRole("button", { name: /ajouter une banque/i }))
    await user.type(screen.getByLabelText(/^nom \*/i), "Banque Internationale")
    await user.type(screen.getByLabelText(/^code \*/i), "B002")
    await user.type(screen.getByLabelText(/^pays \*/i), "France")
    await user.type(screen.getByLabelText(/^adresse \*/i), "45 Rue de la Paix")
    await user.type(screen.getByLabelText(/^téléphone \*/i), "+33 1 4286878")

    await user.click(screen.getByRole("button", { name: "Ajouter" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/banks",
        expect.objectContaining({ method: "POST" }),
      )
    })
  })

  it("pré-remplit le formulaire d'édition avec les données de la banque, et envoie la mise à jour", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<BanksManagement />)
    await screen.findByText("Banque Centrale")

    await user.click(screen.getByRole("button", { name: /modifier/i }))
    expect(await screen.findByDisplayValue("Banque Centrale")).toBeInTheDocument()
    expect(screen.getByDisplayValue("B001")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Modifier" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/banks/${bankA.id}`,
        expect.objectContaining({ method: "PUT" }),
      )
    })
  })

  it("ne supprime pas la banque si l'utilisateur annule la confirmation", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<BanksManagement />)
    await screen.findByText("Banque Centrale")

    await user.click(screen.getByRole("button", { name: /supprimer/i }))
    await annulerConfirmation(user)

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining(`/api/banks/${bankA.id}`),
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("supprime la banque après confirmation", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<BanksManagement />)
    await screen.findByText("Banque Centrale")

    await user.click(screen.getByRole("button", { name: /supprimer/i }))
    await repondreConfirmation(user, /^supprimer$/i)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/banks/${bankA.id}`,
        expect.objectContaining({ method: "DELETE" }),
      )
    })
  })

  it("bascule le statut actif/inactif après confirmation", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<BanksManagement />)
    await screen.findByText("Banque Centrale")

    await user.click(screen.getByRole("button", { name: /désactiver/i }))
    await repondreConfirmation(user, /^désactiver$/i)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/banks/${bankA.id}`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ isActive: false }),
        }),
      )
    })
  })

  it("pré-remplit la recherche depuis le paramètre d'URL ?q=", async () => {
    mockSearchParams.set("q", "Banque Centrale")
    setupFetchMock()
    render(<BanksManagement />)

    await screen.findByText("Banque Centrale")
    expect(screen.getByPlaceholderText(/nom, code ou pays/i)).toHaveValue("Banque Centrale")
  })
})
