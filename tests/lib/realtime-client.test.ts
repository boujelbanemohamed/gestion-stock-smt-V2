import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const authenticatedFetchMock = vi.fn()
vi.mock("@/lib/api-client", () => ({
  authenticatedFetch: (...args: unknown[]) => authenticatedFetchMock(...args),
}))

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  closed = false
  private handlers: Record<string, Array<(e: any) => void>> = {}

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: (e: any) => void) {
    ;(this.handlers[type] ||= []).push(cb)
  }

  close() {
    this.closed = true
  }

  emit(type: string, data: unknown) {
    ;(this.handlers[type] || []).forEach((cb) => cb({ data: JSON.stringify(data) }))
  }

  triggerError() {
    ;(this.handlers["error"] || []).forEach((cb) => cb({}))
  }
}

function ticketResponse(ticket: string, ok = true) {
  return { ok, json: async () => ({ success: ok, data: { ticket } }) } as Response
}

// Laisse les micro-tâches en attente (résolution du ticket mocké, du .json())
// se dérouler avant de vérifier l'état de la connexion — sans dépendre de
// timers, réels ou simulés.
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("subscribeToRealtime", () => {
  beforeEach(() => {
    vi.resetModules()
    FakeEventSource.instances.length = 0
    vi.stubGlobal("EventSource", FakeEventSource)
    authenticatedFetchMock.mockReset()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    vi.useRealTimers()
  })

  it("ne se connecte pas s'il n'y a pas de token d'accès stocké", async () => {
    const { subscribeToRealtime } = await import("@/lib/realtime-client")
    subscribeToRealtime("notification", vi.fn())
    await flush()

    expect(FakeEventSource.instances).toHaveLength(0)
    expect(authenticatedFetchMock).not.toHaveBeenCalled()
  })

  it("demande un ticket temps réel puis ouvre une seule connexion SSE partagée entre plusieurs abonnés", async () => {
    localStorage.setItem("accessToken", "token-123")
    authenticatedFetchMock.mockResolvedValue(ticketResponse("ticket-abc"))
    const { subscribeToRealtime } = await import("@/lib/realtime-client")

    subscribeToRealtime("notification", vi.fn())
    subscribeToRealtime("movement", vi.fn())
    await flush()

    // Un seul ticket demandé pour les deux abonnés, jamais le token d'accès
    // lui-même transmis à EventSource.
    expect(authenticatedFetchMock).toHaveBeenCalledTimes(1)
    expect(authenticatedFetchMock).toHaveBeenCalledWith("/api/events/ticket", { method: "POST" })
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0].url).toBe("/api/events?ticket=ticket-abc")
  })

  it("distribue les événements reçus aux gestionnaires abonnés, avec les données parsées", async () => {
    localStorage.setItem("accessToken", "token-123")
    authenticatedFetchMock.mockResolvedValue(ticketResponse("ticket-abc"))
    const { subscribeToRealtime } = await import("@/lib/realtime-client")

    const handler = vi.fn()
    subscribeToRealtime("notification", handler)
    await flush()

    FakeEventSource.instances[0].emit("notification", { id: "notif-1", title: "Stock bas" })
    expect(handler).toHaveBeenCalledWith({ id: "notif-1", title: "Stock bas" })
  })

  it("ferme la connexion quand le dernier abonné se désabonne", async () => {
    localStorage.setItem("accessToken", "token-123")
    authenticatedFetchMock.mockResolvedValue(ticketResponse("ticket-abc"))
    const { subscribeToRealtime } = await import("@/lib/realtime-client")

    const unsubscribeA = subscribeToRealtime("notification", vi.fn())
    const unsubscribeB = subscribeToRealtime("movement", vi.fn())
    await flush()

    unsubscribeA()
    expect(FakeEventSource.instances[0].closed).toBe(false) // encore un abonné actif

    unsubscribeB()
    expect(FakeEventSource.instances[0].closed).toBe(true)
  })

  // Le cœur du correctif : un ticket périmé (60s) ferait retenter EventSource
  // indéfiniment la même URL si on laissait faire sa reconnexion native. Le
  // client doit fermer, redemander un ticket frais, et rouvrir lui-même.
  it("redemande un ticket frais et rouvre la connexion après une erreur, plutôt que de laisser EventSource rejouer le même ticket périmé", async () => {
    localStorage.setItem("accessToken", "token-123")
    authenticatedFetchMock
      .mockResolvedValueOnce(ticketResponse("ticket-1"))
      .mockResolvedValueOnce(ticketResponse("ticket-2"))
    const { subscribeToRealtime } = await import("@/lib/realtime-client")

    subscribeToRealtime("notification", vi.fn())
    await flush()
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0].url).toBe("/api/events?ticket=ticket-1")

    vi.useFakeTimers()
    FakeEventSource.instances[0].triggerError()
    expect(FakeEventSource.instances[0].closed).toBe(true)
    // Pas de reconnexion immédiate : le délai avant nouvelle tentative n'est pas écoulé.
    expect(FakeEventSource.instances).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(3000)

    expect(authenticatedFetchMock).toHaveBeenCalledTimes(2)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(FakeEventSource.instances[1].url).toBe("/api/events?ticket=ticket-2")
  })

  // Si le serveur ne répond pas (ticket introuvable), le client ne doit pas
  // rester bloqué : il réessaie après le même délai, sans boucle immédiate.
  it("retente après le délai si l'obtention du ticket échoue", async () => {
    localStorage.setItem("accessToken", "token-123")
    authenticatedFetchMock
      .mockResolvedValueOnce(ticketResponse("", false))
      .mockResolvedValueOnce(ticketResponse("ticket-2"))
    const { subscribeToRealtime } = await import("@/lib/realtime-client")

    vi.useFakeTimers()
    subscribeToRealtime("notification", vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    expect(FakeEventSource.instances).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(3000)
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0].url).toBe("/api/events?ticket=ticket-2")
  })
})
