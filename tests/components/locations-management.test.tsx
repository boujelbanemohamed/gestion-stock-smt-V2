import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import LocationsManagement from "@/components/dashboard/locations-management"

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

const bankA = { id: "bank-1", name: "Banque Centrale", isActive: true }

const locationA = {
  id: "loc-1",
  name: "Coffre Principal",
  description: "Coffre-fort du siège",
  bankId: "bank-1",
  isActive: true,
  stockLevels: [],
}

function setupFetchMock(locations: any[] = [locationA]) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.startsWith("/api/locations/") && options?.method === "PUT") {
      return jsonResponse({ success: true, data: { ...locationA } })
    }
    if (url.startsWith("/api/locations/") && options?.method === "DELETE") {
      return jsonResponse({ success: true })
    }
    if (url === "/api/locations" && options?.method === "POST") {
      return jsonResponse({ success: true, data: { ...locationA, id: "loc-2" } })
    }
    if (url.startsWith("/api/locations")) {
      return jsonResponse({ success: true, data: locations })
    }
    if (url.startsWith("/api/banks")) {
      return jsonResponse({ success: true, data: [bankA] })
    }
    if (url.startsWith("/api/cards")) {
      return jsonResponse({ success: true, data: [] })
    }
    if (url.startsWith("/api/config")) {
      return jsonResponse({ success: true, data: { general: { logo: "" } } })
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

async function expandBankGroup(user: ReturnType<typeof userEvent.setup>, bankName: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(bankName) }))
}

async function selectBank(user: ReturnType<typeof userEvent.setup>, bankName: string) {
  const dialog = screen.getByRole("dialog")
  const combobox = within(dialog).getByRole("combobox")
  await user.click(combobox)
  await user.click(await screen.findByRole("option", { name: bankName }))
}

describe("LocationsManagement", () => {
  beforeEach(() => {
    mockSearchParams.delete("q")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("charge et affiche les emplacements groupés par banque", async () => {
    setupFetchMock()
    render(<LocationsManagement />)

    expect(await screen.findByText("Banque Centrale")).toBeInTheDocument()
    expect(screen.getAllByText(/1 emplacement/).length).toBeGreaterThan(0)
  })

  it("affiche un message quand aucun emplacement n'existe", async () => {
    setupFetchMock([])
    render(<LocationsManagement />)

    expect(await screen.findByText(/aucun emplacement/i)).toBeInTheDocument()
  })

  it("crée un nouvel emplacement avec une banque sélectionnée", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<LocationsManagement />)
    await screen.findByText("Banque Centrale")

    await user.click(screen.getByRole("button", { name: /ajouter un emplacement/i }))
    await user.type(screen.getByLabelText(/^nom/i), "Coffre Secondaire")
    await selectBank(user, "Banque Centrale")

    await user.click(screen.getByRole("button", { name: "Ajouter" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/locations", expect.objectContaining({ method: "POST" }))
    })
  })

  it("pré-remplit le formulaire d'édition et envoie la mise à jour", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<LocationsManagement />)
    await screen.findByText("Banque Centrale")

    await expandBankGroup(user, "Banque Centrale")
    await user.click(await screen.findByRole("button", { name: /modifier/i }))

    expect(await screen.findByDisplayValue("Coffre Principal")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Modifier" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/locations/${locationA.id}`,
        expect.objectContaining({ method: "PUT" }),
      )
    })
  })

  it("ne supprime pas l'emplacement si l'utilisateur annule la confirmation", async () => {
    const fetchMock = setupFetchMock()
    vi.spyOn(window, "confirm").mockReturnValue(false)
    const user = userEvent.setup()
    render(<LocationsManagement />)
    await screen.findByText("Banque Centrale")

    await expandBankGroup(user, "Banque Centrale")
    await user.click(await screen.findByRole("button", { name: /supprimer/i }))

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining(`/api/locations/${locationA.id}`),
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("supprime l'emplacement après confirmation", async () => {
    const fetchMock = setupFetchMock()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.spyOn(window, "alert").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<LocationsManagement />)
    await screen.findByText("Banque Centrale")

    await expandBankGroup(user, "Banque Centrale")
    await user.click(await screen.findByRole("button", { name: /supprimer/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/locations/${locationA.id}`,
        expect.objectContaining({ method: "DELETE" }),
      )
    })
  })

  it("bascule le statut actif/inactif après confirmation", async () => {
    const fetchMock = setupFetchMock()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const user = userEvent.setup()
    render(<LocationsManagement />)
    await screen.findByText("Banque Centrale")

    await expandBankGroup(user, "Banque Centrale")
    await user.click(await screen.findByRole("button", { name: /désactiver/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/locations/${locationA.id}`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ isActive: false }),
        }),
      )
    })
  })
})
