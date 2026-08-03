import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  authenticatedFetch,
  clearAuthTokens,
  getAuthHeaders,
  isAuthenticated,
  logout,
  saveAuthTokens,
} from "@/lib/api-client"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

describe("getAuthHeaders", () => {
  afterEach(() => localStorage.clear())

  it("n'inclut pas d'en-tête Authorization sans token stocké", () => {
    const headers = getAuthHeaders() as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("inclut le token Bearer quand un accessToken est stocké", () => {
    localStorage.setItem("accessToken", "abc123")
    const headers = getAuthHeaders() as Record<string, string>
    expect(headers.Authorization).toBe("Bearer abc123")
  })
})

describe("saveAuthTokens / clearAuthTokens / isAuthenticated", () => {
  afterEach(() => localStorage.clear())

  it("sauvegarde les tokens et l'utilisateur courant", () => {
    saveAuthTokens("access-1", "refresh-1", { id: "u1", email: "jane@example.com" })
    expect(localStorage.getItem("accessToken")).toBe("access-1")
    expect(localStorage.getItem("refreshToken")).toBe("refresh-1")
    expect(JSON.parse(localStorage.getItem("currentUser") || "{}")).toEqual({ id: "u1", email: "jane@example.com" })
    expect(isAuthenticated()).toBe(true)
  })

  it("efface les tokens à la déconnexion", () => {
    saveAuthTokens("access-1", "refresh-1", { id: "u1" })
    clearAuthTokens()
    expect(localStorage.getItem("accessToken")).toBeNull()
    expect(localStorage.getItem("refreshToken")).toBeNull()
    expect(localStorage.getItem("currentUser")).toBeNull()
    expect(isAuthenticated()).toBe(false)
  })
})

describe("logout", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    // jsdom n'implémente pas la navigation : on remplace location pour
    // observer la redirection sans qu'elle lève une erreur "not implemented".
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true })
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  // Le bug corrigé ici : l'ancienne déconnexion n'effaçait que "currentUser",
  // en laissant accessToken/refreshToken intacts — revenir en arrière (ou
  // retaper l'URL du tableau de bord) rouvrait alors la session sans repasser
  // par l'écran de connexion.
  it("efface les trois clés de session et redirige vers l'accueil", async () => {
    saveAuthTokens("access-1", "refresh-1", { id: "u1" })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal("fetch", fetchMock)

    await logout()

    expect(localStorage.getItem("accessToken")).toBeNull()
    expect(localStorage.getItem("refreshToken")).toBeNull()
    expect(localStorage.getItem("currentUser")).toBeNull()
    expect(window.location.href).toBe("/")
  })

  it("journalise la déconnexion côté serveur avec le token courant", async () => {
    saveAuthTokens("access-1", "refresh-1", { id: "u1" })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal("fetch", fetchMock)

    await logout()

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer access-1" }) }),
    )
  })

  // Best-effort : même si le serveur est injoignable, la session locale doit
  // quand même être coupée — sinon un problème réseau empêcherait de se
  // déconnecter.
  it("efface quand même la session locale si l'appel serveur échoue", async () => {
    saveAuthTokens("access-1", "refresh-1", { id: "u1" })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

    await logout()

    expect(localStorage.getItem("accessToken")).toBeNull()
    expect(window.location.href).toBe("/")
  })
})

describe("authenticatedFetch", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it("envoie le token Bearer courant, sans tentative de rafraîchissement si la réponse est OK", async () => {
    localStorage.setItem("accessToken", "access-1")
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal("fetch", fetchMock)

    const response = await authenticatedFetch("/api/cards")

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toBe("Bearer access-1")
  })

  it("rafraîchit le token et rejoue la requête sur un 401, puis met à jour le token stocké", async () => {
    localStorage.setItem("accessToken", "expired-token")
    localStorage.setItem("refreshToken", "refresh-1")

    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/refresh") {
        return jsonResponse({ success: true, data: { accessToken: "new-access-token" } })
      }
      // Première tentative sur l'URL cible : 401. Deuxième tentative (après refresh) : 200.
      const alreadyRetried = fetchMock.mock.calls.filter((c) => c[0] === "/api/cards").length > 1
      return alreadyRetried ? jsonResponse({ success: true }) : jsonResponse({ success: false }, 401)
    })
    vi.stubGlobal("fetch", fetchMock)

    const response = await authenticatedFetch("/api/cards")

    expect(response.status).toBe(200)
    expect(localStorage.getItem("accessToken")).toBe("new-access-token")
    // 1er appel cible (401) + appel de refresh + rejoue de l'appel cible = 3 appels fetch.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("ne fixe pas Content-Type: application/json pour un envoi de FormData", async () => {
    localStorage.setItem("accessToken", "access-1")
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal("fetch", fetchMock)

    const formData = new FormData()
    formData.append("file", new Blob(["x"]), "x.csv")
    await authenticatedFetch("/api/banks/import", { method: "POST", body: formData })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers["Content-Type"]).toBeUndefined()
  })
})
