import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import StatisticsPage from "@/app/dashboard/statistics/page"
import { Toaster } from "@/components/ui/toaster"
import { notifications } from "../helpers/notifications"

// jsdom n'implémente pas ces APIs de pointeur utilisées par Radix Select ;
// sans ce polyfill, ouvrir le menu déroulant lève une TypeError.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const bankA = { id: "bank-1", name: "Banque Centrale", code: "BC01", isActive: true }
const locationA = { id: "loc-1", name: "Coffre Principal", bankId: "bank-1", isActive: true }
const locationB = { id: "loc-2", name: "Coffre Secondaire", bankId: "bank-1", isActive: true }

const calculationResult = {
  quantiteDe: 400,
  quantiteVers: 100,
  total: 500,
  pourcentage: 20,
  fromLocationName: "Coffre Principal",
  toLocationName: "Coffre Secondaire",
  nombreMouvements: 7,
  statsByBank: [
    {
      bankId: "bank-1",
      bankName: "Banque Centrale",
      bankCode: "BC01",
      quantiteDe: 400,
      quantiteVers: 100,
      total: 500,
      pourcentage: 20,
      statsByCardType: [],
    },
  ],
  detailsByDate: [
    {
      date: "2026-01-15T00:00:00.000Z",
      bankId: "bank-1",
      bankName: "Banque Centrale",
      bankCode: "BC01",
      movementType: "transfer",
      cardType: "Débit",
      quantiteDe: 400,
      quantiteVers: 100,
    },
  ],
  totalDetailsDe: 400,
  totalDetailsVers: 100,
  filtres: { dateFrom: null, dateTo: null },
}

function setupFetchMock(overrides: { calculateResponse?: unknown } = {}) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/api/statistics/calculate" && options?.method === "POST") {
      return jsonResponse(overrides.calculateResponse ?? { success: true, data: calculationResult })
    }
    if (url.startsWith("/api/banks")) return jsonResponse({ success: true, data: [bankA] })
    if (url.startsWith("/api/locations")) return jsonResponse({ success: true, data: [locationA, locationB] })
    if (url.startsWith("/api/config")) return jsonResponse({ success: true, data: {} })
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

// Sélectionne une option dans le Select identifié par son <Label htmlFor>.
async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  labelText: string | RegExp,
  optionName: string,
) {
  await user.click(screen.getByLabelText(labelText))
  await user.click(await screen.findByRole("option", { name: optionName }))
}

describe("StatisticsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("désactive le bouton Calculer tant que les emplacements De et Vers ne sont pas choisis", async () => {
    setupFetchMock()
    render(<StatisticsPage />)

    expect(await screen.findByRole("button", { name: /calculer/i })).toBeDisabled()
  })

  it("calcule les statistiques et affiche le pourcentage, les quantités et le nombre de mouvements", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<StatisticsPage />)
    await screen.findByLabelText("Emplacement De *")

    await selectOption(user, "Emplacement De *", locationA.name)
    await selectOption(user, "Emplacement Vers *", locationB.name)

    await user.click(screen.getByRole("button", { name: /calculer/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => c[0] === "/api/statistics/calculate")
      expect(call).toBeTruthy()
    })
    const call = fetchMock.mock.calls.find((c) => c[0] === "/api/statistics/calculate")!
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body).toMatchObject({ fromLocationId: "loc-1", toLocationId: "loc-2" })

    // Le pourcentage et les quantités apparaissent à la fois dans le résumé
    // global et dans le détail par banque : on vérifie leur présence sans
    // exiger l'unicité.
    expect((await screen.findAllByText("20.00%")).length).toBeGreaterThan(0)
    expect(screen.getAllByText("400").length).toBeGreaterThan(0)
    expect(screen.getAllByText("100").length).toBeGreaterThan(0)

    // La ligne de formule, elle, est unique et prouve le calcul affiché.
    expect(screen.getByText(/= \(100 \/ 500\) × 100/)).toBeInTheDocument()
    expect(screen.getByText(/Nombre de mouvements analysés/)).toHaveTextContent("7")
  })

  it("n'affiche aucun résultat si l'API renvoie une erreur", async () => {
    setupFetchMock({ calculateResponse: { success: false, error: "Période invalide" } })
    const user = userEvent.setup()
    render(
      <>
        <StatisticsPage />
        <Toaster />
      </>,
    )
    await screen.findByLabelText("Emplacement De *")

    await selectOption(user, "Emplacement De *", locationA.name)
    await selectOption(user, "Emplacement Vers *", locationB.name)
    await user.click(screen.getByRole("button", { name: /calculer/i }))

    // L'erreur remonte dans une notification de la plateforme : le titre est
    // fixe, le détail vient de l'API.
    expect(await notifications().findByText("Calcul impossible")).toBeInTheDocument()
    expect(notifications().getByText("Période invalide")).toBeInTheDocument()
    expect(screen.queryByText("Résultats du Calcul")).not.toBeInTheDocument()
  })

  it("réinitialise les filtres et efface les résultats affichés", async () => {
    setupFetchMock()
    const user = userEvent.setup()
    render(<StatisticsPage />)
    await screen.findByLabelText("Emplacement De *")

    await selectOption(user, "Emplacement De *", locationA.name)
    await selectOption(user, "Emplacement Vers *", locationB.name)
    await user.click(screen.getByRole("button", { name: /calculer/i }))
    expect(await screen.findByText("Résultats du Calcul")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^réinitialiser$/i }))

    expect(screen.queryByText("Résultats du Calcul")).not.toBeInTheDocument()
    // Les emplacements étant remis à "all", le calcul redevient impossible.
    expect(screen.getByRole("button", { name: /calculer/i })).toBeDisabled()
  })

  it("exporte les statistiques calculées en CSV", async () => {
    setupFetchMock()
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

    render(
      <>
        <Toaster />
        <StatisticsPage />
      </>,
    )
    await screen.findByLabelText("Emplacement De *")

    await selectOption(user, "Emplacement De *", locationA.name)
    await selectOption(user, "Emplacement Vers *", locationB.name)
    await user.click(screen.getByRole("button", { name: /calculer/i }))
    await screen.findByText("Résultats du Calcul")

    await user.click(screen.getByRole("button", { name: /exporter/i }))
    await user.click(await screen.findByRole("menuitem", { name: /exporter en csv/i }))

    await waitFor(() => expect(capturedBlob).toBeDefined())
    expect(await notifications().findByText("Export réussi")).toBeInTheDocument()
  })
})
