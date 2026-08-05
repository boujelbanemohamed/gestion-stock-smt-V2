import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const authenticatedFetchMock = vi.fn()
const clearAuthTokensMock = vi.fn()
vi.mock("@/lib/api-client", () => ({
  authenticatedFetch: (...args: unknown[]) => authenticatedFetchMock(...args),
  clearAuthTokens: () => clearAuthTokensMock(),
}))

import { usePermissions } from "@/hooks/use-permissions"

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response
}

const managerUser = { id: "u1", email: "manager@example.com", role: "manager", firstName: "M", lastName: "N" }

function Sonde() {
  const { permissions, isLoading } = usePermissions()
  if (isLoading) return <div>Chargement…</div>
  return <div data-testid="permissions">{permissions.join(",")}</div>
}

describe("usePermissions", () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem("accessToken", "access-1")
    authenticatedFetchMock.mockReset()
    clearAuthTokensMock.mockReset()
  })

  afterEach(() => localStorage.clear())

  // Corrigé ici : l'appel à /api/roles se faisait par un fetch() brut avec
  // un header Authorization posé à la main, sans passer par
  // authenticatedFetch — un token expiré à ce moment précis échouait sans
  // aucune tentative de rafraîchissement.
  it("interroge /api/roles via authenticatedFetch (pas un fetch brut)", async () => {
    authenticatedFetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/auth/me") return jsonResponse({ success: true, data: managerUser })
      if (url === "/api/roles") {
        return jsonResponse({ success: true, data: [{ role: "manager", permissions: ["banks:view", "cards:read"] }] })
      }
      throw new Error(`URL inattendue: ${url}`)
    })

    render(<Sonde />)

    const el = await screen.findByTestId("permissions")
    expect(el.textContent).toBe("banks:view,cards:view")
    expect(authenticatedFetchMock).toHaveBeenCalledWith("/api/roles")
  })

  // Corrigé ici : les trois copies collées de la table de repli ne
  // portaient jamais le même contenu si l'une d'elles divergeait ; elles
  // sont désormais une seule constante partagée, testée une fois ici.
  it("applique les permissions de repli si /api/roles échoue après authentification", async () => {
    authenticatedFetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/auth/me") return jsonResponse({ success: true, data: managerUser })
      if (url === "/api/roles") return jsonResponse({ success: false }, false)
      throw new Error(`URL inattendue: ${url}`)
    })

    render(<Sonde />)

    const el = await screen.findByTestId("permissions")
    expect(el.textContent).toBe("dashboard:view,banks:view,cards:view,locations:view,movements:view")
  })
})
