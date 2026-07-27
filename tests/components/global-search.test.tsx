import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import GlobalSearch from "@/components/dashboard/global-search"

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

const authenticatedFetchMock = vi.fn()
vi.mock("@/lib/api-client", () => ({
  authenticatedFetch: (...args: unknown[]) => authenticatedFetchMock(...args),
}))

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const EMPTY = { banks: [], cards: [], locations: [], users: [] }

describe("GlobalSearch", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    pushMock.mockClear()
  })

  it("ne lance aucune recherche tant que moins de 2 caractères sont saisis", async () => {
    authenticatedFetchMock.mockResolvedValue(jsonResponse({ success: true, data: EMPTY }))
    const user = userEvent.setup()
    render(<GlobalSearch />)

    await user.type(screen.getByPlaceholderText(/rechercher une carte/i), "a")

    await new Promise((r) => setTimeout(r, 400))
    expect(authenticatedFetchMock).not.toHaveBeenCalled()
  })

  it("recherche (avec anti-rebond) et affiche les résultats groupés par catégorie", async () => {
    authenticatedFetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          banks: [{ id: "bank-1", name: "Banque Centrale", code: "B001" }],
          cards: [{ id: "card-1", name: "Carte Visa", type: "Visa", bankName: "Banque Centrale" }],
          locations: [],
          users: [],
        },
      }),
    )
    const user = userEvent.setup()
    render(<GlobalSearch />)

    await user.type(screen.getByPlaceholderText(/rechercher une carte/i), "Banque")

    await waitFor(
      () => expect(authenticatedFetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/search?q=Banque")),
      { timeout: 2000 },
    )

    expect(await screen.findByText("Banque Centrale")).toBeInTheDocument()
    expect(screen.getByText("Carte Visa")).toBeInTheDocument()
  })

  it("affiche un message quand la recherche ne donne aucun résultat", async () => {
    authenticatedFetchMock.mockResolvedValue(jsonResponse({ success: true, data: EMPTY }))
    const user = userEvent.setup()
    render(<GlobalSearch />)

    await user.type(screen.getByPlaceholderText(/rechercher une carte/i), "xyz")

    expect(await screen.findByText(/aucun résultat pour/i, {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it("navigue vers la page correspondante et réinitialise la recherche au clic sur un résultat", async () => {
    authenticatedFetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { banks: [{ id: "bank-1", name: "Banque Centrale", code: "B001" }], cards: [], locations: [], users: [] },
      }),
    )
    const user = userEvent.setup()
    render(<GlobalSearch />)

    const input = screen.getByPlaceholderText(/rechercher une carte/i)
    await user.type(input, "Banque")

    const result = await screen.findByText("Banque Centrale", {}, { timeout: 2000 })
    await user.click(result)

    expect(pushMock).toHaveBeenCalledWith("/dashboard/banks?q=Banque%20Centrale")
    expect(input).toHaveValue("")
  })
})
