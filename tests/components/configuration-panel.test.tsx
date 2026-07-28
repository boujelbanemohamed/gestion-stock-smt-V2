import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ConfigurationPanel from "@/components/dashboard/configuration-panel"
import { Toaster } from "@/components/ui/toaster"
import { repondreConfirmation } from "../helpers/dialogue-confirmation"

// jsdom n'implémente pas ces APIs de pointeur utilisées par Radix Select ;
// sans ce polyfill, ouvrir le menu déroulant lève une TypeError.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const baseConfig = {
  general: { companyName: "Monetique Tunisie", logo: "", language: "fr", currency: "TND", timezone: "Africa/Tunis" },
  smtp: { host: "", port: 587, secure: false, username: "", password: "", fromEmail: "", fromName: "" },
  notifications: {
    enabled: true,
    lowStockAlerts: { inApp: true, email: true },
    movementNotifications: { inApp: true, email: true },
    userActivityAlerts: { inApp: true, email: true },
    accountEmails: {
      welcomeEmail: true,
      passwordResetEmail: true,
      passwordChangedEmail: true,
      authMethodChangedEmail: true,
    },
    lowStockThreshold: 100,
    criticalStockThreshold: 50,
    emailNotifications: true,
    inAppNotifications: true,
    emailRecipients: [],
  },
  display: { dateFormat: "DD/MM/YYYY", timeFormat: "24h", numberFormat: "fr-TN", itemsPerPage: 10, theme: "light" },
  security: {
    sessionDuration: 480,
    requireStrongPassword: true,
    minPasswordLength: 8,
    twoFactor: {
      enabled: false,
      appName: "Monetique Tunisie",
      issuer: "Monetique",
      codeLength: 6,
      codePeriod: 30,
      algorithm: "SHA1",
      mandatory: false,
      mandatoryRoles: [],
      gracePeriodDays: 7,
    },
    maxLoginAttempts: 5,
    lockoutDuration: 30,
  },
}

const reasonEntry = { id: "reason-1", label: "Réapprovisionnement", isOther: false, isActive: true }
const reasonOther = { id: "reason-other", label: "Autre", isOther: true, isActive: true }

function setupFetchMock(overrides: { testSmtpResponse?: unknown; reasons?: unknown[] } = {}) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/api/config" && options?.method === "PUT") {
      return jsonResponse({ success: true, data: JSON.parse(options.body as string) })
    }
    if (url === "/api/config") return jsonResponse({ success: true, data: baseConfig })
    if (url === "/api/config/test-smtp") {
      return jsonResponse(overrides.testSmtpResponse ?? { success: true })
    }
    if (url === "/api/movement-reasons" && options?.method === "POST") {
      const body = JSON.parse(options.body as string)
      return jsonResponse({ success: true, data: { id: "reason-new", label: body.label, isOther: false, isActive: true } })
    }
    if (url.startsWith("/api/movement-reasons/") && options?.method === "PUT") {
      return jsonResponse({ success: true })
    }
    if (url.startsWith("/api/movement-reasons/") && options?.method === "DELETE") {
      return jsonResponse({ success: true })
    }
    if (url === "/api/movement-reasons") {
      return jsonResponse({ success: true, data: overrides.reasons ?? [reasonEntry, reasonOther] })
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function findPutConfigCall(fetchMock: ReturnType<typeof setupFetchMock>) {
  return fetchMock.mock.calls.find((c) => c[0] === "/api/config" && (c[1] as RequestInit)?.method === "PUT")
}

describe("ConfigurationPanel", () => {
  beforeEach(() => {
    setupFetchMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.documentElement.classList.remove("dark")
  })

  it("modifie le nom de l'entreprise et enregistre la configuration générale", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <ConfigurationPanel />
        <Toaster />
      </>,
    )
    await screen.findByRole("tab", { name: /général/i })

    fireEvent.change(screen.getByLabelText("Nom de l'entreprise"), { target: { value: "Nouvelle Entreprise SA" } })
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => expect(findPutConfigCall(fetchMock)).toBeTruthy())
    const body = JSON.parse((findPutConfigCall(fetchMock)![1] as RequestInit).body as string)
    expect(body.general.companyName).toBe("Nouvelle Entreprise SA")

    // Le bandeau vert propre à cet écran a laissé place à la notification
    // commune à toute la plateforme.
    expect(await screen.findByText("Configuration enregistrée")).toBeInTheDocument()
  })

  it("désactive le bouton de test SMTP tant que le serveur et l'utilisateur ne sont pas renseignés", async () => {
    const user = userEvent.setup()
    render(<ConfigurationPanel />)
    await user.click(await screen.findByRole("tab", { name: /smtp/i }))

    expect(screen.getByRole("button", { name: /envoyer mail test/i })).toBeDisabled()
  })

  it("envoie un email de test SMTP une fois le serveur et l'utilisateur renseignés", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <ConfigurationPanel />
        <Toaster />
      </>,
    )
    await user.click(await screen.findByRole("tab", { name: /smtp/i }))

    fireEvent.change(screen.getByLabelText("Serveur SMTP"), { target: { value: "smtp.mailtrap.io" } })
    fireEvent.change(screen.getByLabelText("Nom d'utilisateur"), { target: { value: "smtpuser" } })

    await user.click(screen.getByRole("button", { name: /envoyer mail test/i }))

    await waitFor(() => {
      const testCall = fetchMock.mock.calls.find((c) => c[0] === "/api/config/test-smtp")
      expect(testCall).toBeTruthy()
    })
    expect(await screen.findByText("Email de test envoyé")).toBeInTheDocument()
  })

  it("affiche l'aide Gmail quand le serveur SMTP contient 'gmail'", async () => {
    const user = userEvent.setup()
    render(<ConfigurationPanel />)
    await user.click(await screen.findByRole("tab", { name: /smtp/i }))

    expect(screen.queryByText(/configuration gmail/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Serveur SMTP"), { target: { value: "smtp.gmail.com" } })

    expect(await screen.findByText(/configuration gmail/i)).toBeInTheDocument()
  })

  it("change le thème vers sombre, l'applique immédiatement et l'enregistre", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<ConfigurationPanel />)
    await user.click(await screen.findByRole("tab", { name: /affichage/i }))

    const tabPanel = await screen.findByRole("tabpanel")
    await user.click(within(tabPanel).getAllByRole("combobox")[0])
    await user.click(await screen.findByRole("option", { name: "Sombre" }))

    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true))
    const body = JSON.parse((findPutConfigCall(fetchMock)![1] as RequestInit).body as string)
    expect(body.display.theme).toBe("dark")
  })

  it("active la 2FA (affiche les réglages avancés) et modifie le nombre maximal de tentatives de connexion", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<ConfigurationPanel />)
    await user.click(await screen.findByRole("tab", { name: /sécurité/i }))

    expect(screen.queryByLabelText("Nom de l'application")).not.toBeInTheDocument()

    const tabPanel = await screen.findByRole("tabpanel")
    // Index 0 = "Exiger un mot de passe fort", index 1 = "Authentification à deux facteurs (2FA)".
    // Ni l'un ni l'autre n'a de nom accessible lié via aria/htmlFor (Switch sans id), d'où la
    // sélection par position, cohérente avec le reste de la suite pour les composants Radix.
    const switches = within(tabPanel).getAllByRole("switch")
    await user.click(switches[1])

    expect(await screen.findByLabelText("Nom de l'application")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/tentatives de connexion maximales/i), { target: { value: "3" } })
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => expect(findPutConfigCall(fetchMock)).toBeTruthy())
    const body = JSON.parse((findPutConfigCall(fetchMock)![1] as RequestInit).body as string)
    expect(body.security.maxLoginAttempts).toBe(3)
    expect(body.security.twoFactor.enabled).toBe(true)
  })

  it("ajoute un nouveau motif de mouvement", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<ConfigurationPanel />)
    await user.click(await screen.findByRole("tab", { name: /motifs/i }))

    await user.type(await screen.findByPlaceholderText("Nouveau motif"), "Contrôle qualité")
    await user.click(screen.getByRole("button", { name: /ajouter/i }))

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (c) => c[0] === "/api/movement-reasons" && (c[1] as RequestInit)?.method === "POST",
      )
      expect(postCall).toBeTruthy()
    })
    const postCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/movement-reasons" && (c[1] as RequestInit)?.method === "POST",
    )!
    const body = JSON.parse((postCall[1] as RequestInit).body as string)
    expect(body).toEqual({ label: "Contrôle qualité" })
  })

  it("modifie le libellé d'un motif existant", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<ConfigurationPanel />)
    await user.click(await screen.findByRole("tab", { name: /motifs/i }))

    const input = await screen.findByDisplayValue(reasonEntry.label)
    const row = input.closest("div") as HTMLElement
    fireEvent.change(input, { target: { value: "Nouveau libellé" } })

    const saveButton = within(row).getAllByRole("button")[0]
    await user.click(saveButton)

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0] === `/api/movement-reasons/${reasonEntry.id}` &&
          (c[1] as RequestInit)?.method === "PUT",
      )
      expect(putCall).toBeTruthy()
    })
    const putCall = fetchMock.mock.calls.find(
      (c) => c[0] === `/api/movement-reasons/${reasonEntry.id}` && (c[1] as RequestInit)?.method === "PUT",
    )!
    const body = JSON.parse((putCall[1] as RequestInit).body as string)
    expect(body).toEqual({ label: "Nouveau libellé" })
  })

  it("supprime un motif après confirmation, mais interdit la suppression du motif protégé Autre", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<ConfigurationPanel />)
    await user.click(await screen.findByRole("tab", { name: /motifs/i }))

    const otherInput = await screen.findByDisplayValue(reasonOther.label)
    const otherRow = otherInput.closest("div") as HTMLElement
    expect(within(otherRow).getAllByRole("button")[1]).toBeDisabled()

    const entryInput = screen.getByDisplayValue(reasonEntry.label)
    const entryRow = entryInput.closest("div") as HTMLElement
    await user.click(within(entryRow).getAllByRole("button")[1])
    await repondreConfirmation(user, /^supprimer$/i)

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        (c) => c[0] === `/api/movement-reasons/${reasonEntry.id}` && (c[1] as RequestInit)?.method === "DELETE",
      )
      expect(deleteCall).toBeTruthy()
    })
  })
})
