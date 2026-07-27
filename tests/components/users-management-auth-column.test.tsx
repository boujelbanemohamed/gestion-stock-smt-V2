import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import UsersManagement from "@/components/dashboard/users-management"

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    user: { id: "u1", role: "admin" },
    permissions: [],
    hasPermission: () => true,
    hasAnyPermission: () => true,
    canAccessModule: () => true,
    isLoading: false,
  }),
}))

const usersWithTwoFactor = [
  {
    id: "u1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "System",
    role: "admin",
    isActive: true,
    twoFactorEnabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "u2",
    email: "jane@example.com",
    firstName: "Jane",
    lastName: "Doe",
    role: "user",
    isActive: true,
    twoFactorEnabled: false,
    createdAt: "2026-01-02T00:00:00.000Z",
  },
]

describe("UsersManagement - colonne Authentification", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.startsWith("/api/users")) return jsonResponse({ success: true, data: usersWithTwoFactor })
        if (url.startsWith("/api/roles")) return jsonResponse({ success: true, data: [] })
        throw new Error(`Unexpected fetch to ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("affiche le type d'authentification de chaque utilisateur", async () => {
    render(<UsersManagement />)

    expect(await screen.findByText("Mot de passe + 2FA")).toBeInTheDocument()
    expect(screen.getByText("Mot de passe seul")).toBeInTheDocument()
    expect(screen.getByText("Authentification")).toBeInTheDocument()
  })
})
