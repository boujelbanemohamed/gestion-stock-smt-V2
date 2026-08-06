import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import CardDetailPage from "@/app/dashboard/cards/[id]/page"

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "card-1" }),
}))

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const baseCard = {
  id: "card-1",
  name: "Carte Débit Standard",
  type: "Débit",
  subType: "Standard",
  subSubType: "National",
  bankId: "bank-1",
  bank: { name: "Banque Centrale" },
  minThreshold: 50,
  maxThreshold: 1000,
  isActive: true,
  stockLevels: [],
}

function setupFetchMock(card: any) {
  const fetchMock = vi.fn((url: string) => {
    if (url.startsWith("/api/cards/")) return jsonResponse({ success: true, data: card })
    if (url.startsWith("/api/movements")) {
      return jsonResponse({ success: true, data: { movements: [], total: 0, totalPages: 1 } })
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("CardDetailPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("affiche le bouton Nouveau mouvement et le badge Active pour une carte active", async () => {
    setupFetchMock(baseCard)
    render(<CardDetailPage />)

    expect(await screen.findByText("Active")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /nouveau mouvement/i })).toBeInTheDocument()
  })

  it("masque le bouton Nouveau mouvement et n'affiche pas d'alerte de stock bas pour une carte inactive", async () => {
    setupFetchMock({ ...baseCard, isActive: false })
    render(<CardDetailPage />)

    expect(await screen.findByText("Inactive")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /nouveau mouvement/i })).not.toBeInTheDocument()
    expect(screen.queryByText("Stock bas")).not.toBeInTheDocument()
  })
})
