import { afterEach, describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import RealtimeBridge from "@/components/dashboard/realtime-bridge"
import { eventBus } from "@/lib/event-bus"

let capturedHandler: ((data: any) => void) | null = null
vi.mock("@/lib/realtime-client", () => ({
  subscribeToRealtime: vi.fn((_event: string, handler: (data: any) => void) => {
    capturedHandler = handler
    return () => {}
  }),
}))

describe("RealtimeBridge", () => {
  afterEach(() => {
    eventBus.clear()
    capturedHandler = null
  })

  it("relaie un mouvement créé vers le bus d'évènements local", () => {
    render(<RealtimeBridge />)
    const listener = vi.fn()
    eventBus.on("movement:created", listener)

    capturedHandler?.({ action: "created", movementId: "mvt-1" })

    expect(listener).toHaveBeenCalledWith({ action: "created", movementId: "mvt-1" })
  })

  it("relaie un mouvement supprimé vers l'évènement movement:deleted", () => {
    render(<RealtimeBridge />)
    const listener = vi.fn()
    eventBus.on("movement:deleted", listener)

    capturedHandler?.({ action: "deleted", movementId: "mvt-1" })

    expect(listener).toHaveBeenCalledWith({ action: "deleted", movementId: "mvt-1" })
  })

  it("relaie un mouvement modifié vers l'évènement movement:updated", () => {
    render(<RealtimeBridge />)
    const listener = vi.fn()
    eventBus.on("movement:updated", listener)

    capturedHandler?.({ action: "updated", movementId: "mvt-1" })

    expect(listener).toHaveBeenCalledWith({ action: "updated", movementId: "mvt-1" })
  })

  it("traite l'absence d'action comme une création (valeur par défaut)", () => {
    render(<RealtimeBridge />)
    const createdListener = vi.fn()
    const deletedListener = vi.fn()
    eventBus.on("movement:created", createdListener)
    eventBus.on("movement:deleted", deletedListener)

    capturedHandler?.({})

    expect(createdListener).toHaveBeenCalled()
    expect(deletedListener).not.toHaveBeenCalled()
  })

  it("ne rend aucun élément visible", () => {
    const { container } = render(<RealtimeBridge />)
    expect(container).toBeEmptyDOMElement()
  })
})
