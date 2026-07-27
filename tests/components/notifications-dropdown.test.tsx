import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import NotificationsDropdown from "@/components/notifications"

// jsdom n'implémente pas ces APIs de pointeur utilisées par les menus Radix,
// ni ResizeObserver utilisé par le composant ScrollArea de la liste.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
if (typeof (globalThis as any).ResizeObserver === "undefined") {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

let capturedHandler: ((data: any) => void) | null = null
vi.mock("@/hooks/use-server-event", () => ({
  useServerEvent: vi.fn((_event: string, handler: (data: any) => void) => {
    capturedHandler = handler
  }),
}))

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const unreadNotification = {
  id: "notif-1",
  type: "warning",
  title: "Stock faible",
  message: "La carte X est en stock bas",
  userId: null,
  isRead: false,
  createdAt: new Date().toISOString(),
}

const readNotification = {
  id: "notif-2",
  type: "info",
  title: "Nouveau mouvement",
  message: "Entrée de 10 unités",
  userId: null,
  isRead: true,
  createdAt: new Date().toISOString(),
}

function setupFetchMock(notifications: any[] = [unreadNotification, readNotification]) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.startsWith("/api/notifications/") && options?.method === "PUT") {
      return jsonResponse({ success: true })
    }
    if (url.startsWith("/api/notifications/") && options?.method === "DELETE") {
      return jsonResponse({ success: true })
    }
    if (url.startsWith("/api/notifications")) {
      return jsonResponse({ success: true, data: notifications })
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("NotificationsDropdown", () => {
  beforeEach(() => {
    localStorage.setItem("currentUser", JSON.stringify({ id: "user-1", email: "jane@example.com" }))
    capturedHandler = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it("affiche le nombre de notifications non lues sur le badge", async () => {
    setupFetchMock()
    render(<NotificationsDropdown />)

    expect(await screen.findByText("1")).toBeInTheDocument()
  })

  it("affiche la liste des notifications à l'ouverture du menu", async () => {
    setupFetchMock()
    const user = userEvent.setup()
    render(<NotificationsDropdown />)
    await screen.findByText("1")

    await user.click(screen.getByRole("button"))

    expect(await screen.findByText("Stock faible")).toBeInTheDocument()
    expect(screen.getByText("Nouveau mouvement")).toBeInTheDocument()
  })

  it("affiche un message quand il n'y a aucune notification", async () => {
    setupFetchMock([])
    const user = userEvent.setup()
    render(<NotificationsDropdown />)

    await user.click(screen.getByRole("button"))

    expect(await screen.findByText("Aucune notification")).toBeInTheDocument()
  })

  it("marque une notification comme lue", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<NotificationsDropdown />)
    await screen.findByText("1")

    await user.click(screen.getByRole("button"))
    await screen.findByText("Stock faible")
    await user.click(screen.getByRole("button", { name: "Marquer comme lu" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/notifications/${unreadNotification.id}`,
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ isRead: true }) }),
      )
    })
  })

  it("supprime une notification", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<NotificationsDropdown />)
    await screen.findByText("1")

    await user.click(screen.getByRole("button"))
    await screen.findByText("Stock faible")
    await user.click(screen.getAllByRole("button", { name: /supprimer/i })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/notifications/${unreadNotification.id}`,
        expect.objectContaining({ method: "DELETE" }),
      )
    })
  })

  it("marque toutes les notifications non lues comme lues", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<NotificationsDropdown />)
    await screen.findByText("1")

    await user.click(screen.getByRole("button"))
    await user.click(await screen.findByRole("button", { name: /tout marquer comme lu/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/notifications/${unreadNotification.id}`,
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ isRead: true }) }),
      )
    })
  })

  it("recharge les notifications à la réception d'un évènement temps réel", async () => {
    const fetchMock = setupFetchMock()
    render(<NotificationsDropdown />)
    await screen.findByText("1")
    fetchMock.mockClear()

    capturedHandler?.({})

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/notifications?userId=user-1"),
        expect.anything(),
      )
    })
  })
})
