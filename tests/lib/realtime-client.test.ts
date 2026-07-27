import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
}

describe("subscribeToRealtime", () => {
  beforeEach(() => {
    vi.resetModules()
    FakeEventSource.instances.length = 0
    vi.stubGlobal("EventSource", FakeEventSource)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("ne se connecte pas s'il n'y a pas de token d'accès stocké", async () => {
    const { subscribeToRealtime } = await import("@/lib/realtime-client")
    subscribeToRealtime("notification", vi.fn())
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it("ouvre une seule connexion SSE partagée entre plusieurs abonnés", async () => {
    localStorage.setItem("accessToken", "token-123")
    const { subscribeToRealtime } = await import("@/lib/realtime-client")

    subscribeToRealtime("notification", vi.fn())
    subscribeToRealtime("movement", vi.fn())

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0].url).toContain("/api/events?token=token-123")
  })

  it("distribue les événements reçus aux gestionnaires abonnés, avec les données parsées", async () => {
    localStorage.setItem("accessToken", "token-123")
    const { subscribeToRealtime } = await import("@/lib/realtime-client")

    const handler = vi.fn()
    subscribeToRealtime("notification", handler)

    FakeEventSource.instances[0].emit("notification", { id: "notif-1", title: "Stock bas" })
    expect(handler).toHaveBeenCalledWith({ id: "notif-1", title: "Stock bas" })
  })

  it("ferme la connexion quand le dernier abonné se désabonne", async () => {
    localStorage.setItem("accessToken", "token-123")
    const { subscribeToRealtime } = await import("@/lib/realtime-client")

    const unsubscribeA = subscribeToRealtime("notification", vi.fn())
    const unsubscribeB = subscribeToRealtime("movement", vi.fn())

    unsubscribeA()
    expect(FakeEventSource.instances[0].closed).toBe(false) // encore un abonné actif

    unsubscribeB()
    expect(FakeEventSource.instances[0].closed).toBe(true)
  })
})
