import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import LogsPanel from "@/components/dashboard/logs-panel"

// jsdom n'implémente pas ces APIs de pointeur utilisées par Radix Select ;
// sans ce polyfill, ouvrir le menu déroulant lève une TypeError.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const admin = { id: "u1", email: "admin@example.com", firstName: "Admin", lastName: "System", role: "admin" }
const operator = { id: "u2", email: "op@example.com", firstName: "Paul", lastName: "Martin", role: "operator" }

const logDelete = {
  id: "log-1",
  timestamp: "2026-01-15T10:30:00.000Z",
  userId: "u1",
  userEmail: admin.email,
  userName: "Admin System",
  action: "delete",
  module: "movements",
  entityType: "movement",
  details: "Suppression du mouvement Sortie - Visa Classique",
  status: "success",
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
}

const logCreate = {
  id: "log-2",
  timestamp: "2026-01-16T09:00:00.000Z",
  userId: "u2",
  userEmail: operator.email,
  userName: "Paul Martin",
  action: "create",
  module: "banks",
  entityType: "bank",
  details: "Création de la banque Zitouna",
  status: "success",
  ipAddress: "10.0.0.4",
  userAgent: "test-agent",
}

function setupFetchMock() {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes("/api/logs")) {
      return jsonResponse({ success: true, data: [logDelete, logCreate], total: 2 })
    }
    if (url.includes("/api/users")) return jsonResponse({ success: true, data: [admin, operator] })
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

async function selectFilter(
  user: ReturnType<typeof userEvent.setup>,
  labelText: string,
  optionName: string | RegExp,
) {
  await user.click(screen.getByLabelText(labelText))
  await user.click(await screen.findByRole("option", { name: optionName }))
}

describe("LogsPanel - filtres", () => {
  beforeEach(() => {
    setupFetchMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("affiche tous les logs chargés avec leur action, module et utilisateur", async () => {
    render(<LogsPanel />)

    expect(await screen.findByText(logDelete.details)).toBeInTheDocument()
    expect(screen.getByText(logCreate.details)).toBeInTheDocument()
    expect(screen.getByText("Suppression")).toBeInTheDocument()
    expect(screen.getByText("Création")).toBeInTheDocument()
    expect(screen.getByText("Mouvements")).toBeInTheDocument()
    expect(screen.getByText("Banques")).toBeInTheDocument()
    expect(screen.getByText("2 logs trouvés")).toBeInTheDocument()
  })

  // Corrigé ici : deux effets séparés appelaient chacun loadLogs() au
  // montage (l'un explicitement, l'autre via ses dépendances startDate/
  // endDate déjà présentes dès le premier rendu), doublant inutilement le
  // chargement à chaque ouverture de la page.
  it("ne charge les logs qu'une seule fois au montage", async () => {
    const fetchMock = setupFetchMock()
    render(<LogsPanel />)
    await screen.findByText(logDelete.details)

    const logsCalls = fetchMock.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/api/logs"),
    )
    expect(logsCalls).toHaveLength(1)
  })

  it("filtre les logs par terme de recherche", async () => {
    const user = userEvent.setup()
    render(<LogsPanel />)
    await screen.findByText(logDelete.details)

    await user.type(screen.getByLabelText("Recherche"), "Zitouna")

    await waitFor(() => expect(screen.queryByText(logDelete.details)).not.toBeInTheDocument())
    expect(screen.getByText(logCreate.details)).toBeInTheDocument()
    expect(screen.getByText("1 log trouvé")).toBeInTheDocument()
  })

  it("filtre les logs par action", async () => {
    const user = userEvent.setup()
    render(<LogsPanel />)
    await screen.findByText(logDelete.details)

    await selectFilter(user, "Action", "Suppression")

    await waitFor(() => expect(screen.queryByText(logCreate.details)).not.toBeInTheDocument())
    expect(screen.getByText(logDelete.details)).toBeInTheDocument()
  })

  it("filtre les logs par module", async () => {
    const user = userEvent.setup()
    render(<LogsPanel />)
    await screen.findByText(logDelete.details)

    await selectFilter(user, "Module", "Banques")

    await waitFor(() => expect(screen.queryByText(logDelete.details)).not.toBeInTheDocument())
    expect(screen.getByText(logCreate.details)).toBeInTheDocument()
  })

  it("filtre les logs par utilisateur", async () => {
    const user = userEvent.setup()
    render(<LogsPanel />)
    await screen.findByText(logDelete.details)

    await selectFilter(user, "Utilisateur", /Paul Martin/)

    await waitFor(() => expect(screen.queryByText(logDelete.details)).not.toBeInTheDocument())
    expect(screen.getByText(logCreate.details)).toBeInTheDocument()
  })

  it("recharge les logs depuis l'API quand la période change", async () => {
    const fetchMock = setupFetchMock()
    render(<LogsPanel />)
    await screen.findByText(logDelete.details)
    fetchMock.mockClear()

    fireEvent.change(screen.getByLabelText("Date de début"), { target: { value: "2026-01-16" } })

    await waitFor(() => {
      const logsCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === "string" && (c[0] as string).includes("dateFrom=2026-01-16"),
      )
      expect(logsCall).toBeTruthy()
    })
  })

  it("affiche un message quand aucun log ne correspond aux filtres, puis les restaure au clic sur Réinitialiser", async () => {
    const user = userEvent.setup()
    render(<LogsPanel />)
    await screen.findByText(logDelete.details)

    await user.type(screen.getByLabelText("Recherche"), "introuvable-xyz")

    expect(await screen.findByText("Aucun log trouvé")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /réinitialiser les filtres/i }))

    expect(await screen.findByText(logDelete.details)).toBeInTheDocument()
    expect(screen.getByText(logCreate.details)).toBeInTheDocument()
  })
})
