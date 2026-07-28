import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import UsersManagement from "@/components/dashboard/users-management"
import { repondreConfirmation } from "../helpers/dialogue-confirmation"

// jsdom n'implémente pas ces APIs de pointeur utilisées par Radix Select ;
// sans ce polyfill, ouvrir le menu déroulant lève une TypeError.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

let mockCurrentUserRole = "admin"
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    user: { id: "current-admin", role: mockCurrentUserRole },
    permissions: [],
    hasPermission: () => true,
    hasAnyPermission: () => true,
    canAccessModule: () => true,
    isLoading: false,
  }),
}))

const targetUser = {
  id: "u2",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  isActive: true,
  twoFactorEnabled: false,
  createdAt: "2026-01-02T00:00:00.000Z",
}

describe("UsersManagement - contrôle super admin du type d'authentification", () => {
  beforeEach(() => {
    mockCurrentUserRole = "admin"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("un super admin peut basculer le type d'authentification d'un utilisateur", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith("/api/users/u2/two-factor") && init?.method === "PATCH") {
        return jsonResponse({ success: true, data: { ...targetUser, twoFactorEnabled: true } })
      }
      if (url.startsWith("/api/users")) return jsonResponse({ success: true, data: [targetUser] })
      if (url.startsWith("/api/roles")) return jsonResponse({ success: true, data: [] })
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<UsersManagement />)

    await user.click(await screen.findByRole("button", { name: /modifier/i }))

    const select = await screen.findByLabelText("Type d'authentification")
    await user.click(select)
    await user.click(await screen.findByText("Mot de passe + 2FA"))

    await user.click(screen.getByRole("button", { name: /appliquer le type d'authentification/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/users/u2/two-factor",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ enabled: true }) }),
      ),
    )
  })

  it("un super admin peut réinitialiser la configuration 2FA d'un utilisateur", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith("/api/users/u2/two-factor/reset") && init?.method === "POST") {
        return jsonResponse({ success: true, data: targetUser })
      }
      if (url.startsWith("/api/users")) return jsonResponse({ success: true, data: [targetUser] })
      if (url.startsWith("/api/roles")) return jsonResponse({ success: true, data: [] })
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<UsersManagement />)

    await user.click(await screen.findByRole("button", { name: /modifier/i }))
    await user.click(await screen.findByRole("button", { name: /réinitialiser la 2fa/i }))
    await repondreConfirmation(user, /^réinitialiser$/i)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/users/u2/two-factor/reset",
        expect.objectContaining({ method: "POST" }),
      ),
    )
  })

  it("n'affiche pas les contrôles d'authentification pour un utilisateur qui n'est pas super admin", async () => {
    mockCurrentUserRole = "manager"
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.startsWith("/api/users")) return jsonResponse({ success: true, data: [targetUser] })
        if (url.startsWith("/api/roles")) return jsonResponse({ success: true, data: [] })
        throw new Error(`Unexpected fetch to ${url}`)
      }),
    )

    render(<UsersManagement />)

    await user.click(await screen.findByRole("button", { name: /modifier/i }))

    expect(screen.queryByLabelText("Type d'authentification")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /réinitialiser la 2fa/i })).not.toBeInTheDocument()
  })
})
