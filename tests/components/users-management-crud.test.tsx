import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import UsersManagement from "@/components/dashboard/users-management"
import { Toaster } from "@/components/ui/toaster"

// jsdom n'implémente pas ces APIs de pointeur utilisées par Radix Select ;
// sans ce polyfill, ouvrir le menu déroulant lève une TypeError.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

let mockHasPermission = (_module: string, _action: string) => true
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    user: { id: "current-admin", role: "manager" },
    permissions: [],
    hasPermission: (module: string, action: string) => mockHasPermission(module, action),
    hasAnyPermission: () => true,
    canAccessModule: () => true,
    isLoading: false,
  }),
}))

const targetUser = {
  id: "u1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "viewer",
  isActive: true,
  twoFactorEnabled: false,
  createdAt: "2026-01-02T00:00:00.000Z",
}

const roles = [
  { id: "role-1", role: "viewer", description: "Utilisateur standard", permissions: [], isCustom: false },
  { id: "role-2", role: "manager", description: "Administrateur", permissions: [], isCustom: false },
]

function setupFetchMock(overrides: { users?: unknown[]; postResponse?: unknown } = {}) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/api/users" && options?.method === "POST") {
      return jsonResponse(overrides.postResponse ?? { success: true, data: { ...targetUser, id: "u-new" } })
    }
    if (url.startsWith("/api/users/") && options?.method === "PUT") {
      return jsonResponse({ success: true, data: targetUser })
    }
    if (url.startsWith("/api/users")) {
      return jsonResponse({ success: true, data: overrides.users ?? [targetUser] })
    }
    if (url.startsWith("/api/roles")) return jsonResponse({ success: true, data: roles })
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("UsersManagement - création, édition et statut", () => {
  beforeEach(() => {
    mockHasPermission = () => true
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("affiche les erreurs de validation si les champs obligatoires sont vides", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<UsersManagement />)

    await user.click(await screen.findByRole("button", { name: /ajouter un utilisateur/i }))
    await user.click(screen.getByRole("button", { name: "Ajouter" }))

    expect(await screen.findByText("L'email est obligatoire")).toBeInTheDocument()
    expect(screen.getByText("Le prénom est obligatoire")).toBeInTheDocument()
    expect(screen.getByText("Le nom est obligatoire")).toBeInTheDocument()

    const postCall = fetchMock.mock.calls.find((c) => c[0] === "/api/users" && (c[1] as RequestInit)?.method === "POST")
    expect(postCall).toBeUndefined()
  })

  it("crée un nouvel utilisateur avec succès", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <UsersManagement />
      </>,
    )
    await screen.findByText(targetUser.email)

    await user.click(screen.getByRole("button", { name: /ajouter un utilisateur/i }))

    await user.type(screen.getByLabelText("Email *"), "new.user@example.com")
    await user.type(screen.getByLabelText("Prénom *"), "Paul")
    await user.type(screen.getByLabelText("Nom *"), "Martin")

    await user.click(screen.getByRole("button", { name: "Ajouter" }))

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find((c) => c[0] === "/api/users" && (c[1] as RequestInit)?.method === "POST")
      expect(postCall).toBeTruthy()
    })
    const postCall = fetchMock.mock.calls.find((c) => c[0] === "/api/users" && (c[1] as RequestInit)?.method === "POST")!
    const body = JSON.parse((postCall[1] as RequestInit).body as string)
    expect(body).toMatchObject({
      email: "new.user@example.com",
      firstName: "Paul",
      lastName: "Martin",
      role: "viewer",
      isActive: true,
    })
    expect(await screen.findByText("Utilisateur créé")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  // Le mot de passe généré doit rester lisible le temps d'être recopié : il a
  // sa propre fenêtre, il ne disparaît pas comme une notification.
  it("présente le mot de passe généré dans une fenêtre dédiée, copiable", async () => {
    setupFetchMock({
      postResponse: { success: true, data: { ...targetUser, id: "u-new" }, generatedPassword: "Xy7!mQ2r" },
    })
    // userEvent.setup() installe son propre presse-papiers dans jsdom : on lit
    // ce qui y a été écrit plutôt que d'espionner l'API.
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <UsersManagement />
      </>,
    )
    await screen.findByText(targetUser.email)

    await user.click(screen.getByRole("button", { name: /ajouter un utilisateur/i }))
    await user.type(screen.getByLabelText("Email *"), "new.user@example.com")
    await user.type(screen.getByLabelText("Prénom *"), "Paul")
    await user.type(screen.getByLabelText("Nom *"), "Martin")
    await user.click(screen.getByRole("button", { name: "Ajouter" }))

    const fenetre = await screen.findByRole("dialog")
    expect(within(fenetre).getByText("Xy7!mQ2r")).toBeInTheDocument()

    await user.click(within(fenetre).getByRole("button", { name: /copier le mot de passe/i }))
    expect(await navigator.clipboard.readText()).toBe("Xy7!mQ2r")
    expect(await screen.findByText("Mot de passe copié.")).toBeInTheDocument()
  })

  it("modifie un utilisateur existant", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <UsersManagement />
      </>,
    )

    await user.click(await screen.findByRole("button", { name: /modifier/i }))
    fireEvent.change(screen.getByLabelText("Prénom *"), { target: { value: "Janet" } })

    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        (c) => c[0] === `/api/users/${targetUser.id}` && (c[1] as RequestInit)?.method === "PUT",
      )
      expect(putCall).toBeTruthy()
    })
    const putCall = fetchMock.mock.calls.find(
      (c) => c[0] === `/api/users/${targetUser.id}` && (c[1] as RequestInit)?.method === "PUT",
    )!
    const body = JSON.parse((putCall[1] as RequestInit).body as string)
    expect(body.firstName).toBe("Janet")

    expect(await screen.findByText("Utilisateur mis à jour")).toBeInTheDocument()
  })

  it("désactive un utilisateur actif", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<UsersManagement />)

    await user.click(await screen.findByRole("button", { name: /désactiver/i }))

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        (c) => c[0] === `/api/users/${targetUser.id}` && (c[1] as RequestInit)?.method === "PUT",
      )
      expect(putCall).toBeTruthy()
    })
    const putCall = fetchMock.mock.calls.find(
      (c) => c[0] === `/api/users/${targetUser.id}` && (c[1] as RequestInit)?.method === "PUT",
    )!
    const body = JSON.parse((putCall[1] as RequestInit).body as string)
    expect(body).toEqual({ isActive: false })
  })

  it("masque les actions de création/modification si l'utilisateur n'a pas la permission", async () => {
    mockHasPermission = () => false
    setupFetchMock()
    render(<UsersManagement />)
    await screen.findByText(targetUser.email)

    expect(screen.queryByRole("button", { name: /ajouter un utilisateur/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /modifier/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /désactiver/i })).not.toBeInTheDocument()
  })
})
