"use client"

// Connexion SSE (Server-Sent Events) partagée côté client : un seul EventSource
// par onglet, quel que soit le nombre de composants abonnés (bell de
// notifications, synchronisation des mouvements, etc.), avec reconnexion
// automatique gérée nativement par le navigateur.

type RealtimeEvent = "notification" | "movement"
type RealtimeHandler = (data: any) => void

const listeners: Record<RealtimeEvent, Set<RealtimeHandler>> = {
  notification: new Set(),
  movement: new Set(),
}

let eventSource: EventSource | null = null
let subscriberCount = 0

function parseAndDispatch(event: RealtimeEvent, raw: MessageEvent) {
  try {
    const data = JSON.parse(raw.data)
    listeners[event].forEach((handler) => handler(data))
  } catch (error) {
    console.error(`[realtime] Error handling "${event}" event:`, error)
  }
}

function connect() {
  if (eventSource || typeof window === "undefined") return

  const token = localStorage.getItem("accessToken")
  if (!token) return

  const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`)
  source.addEventListener("notification", (e) => parseAndDispatch("notification", e as MessageEvent))
  source.addEventListener("movement", (e) => parseAndDispatch("movement", e as MessageEvent))
  eventSource = source
}

function disconnect() {
  eventSource?.close()
  eventSource = null
}

export function subscribeToRealtime(event: RealtimeEvent, handler: RealtimeHandler): () => void {
  listeners[event].add(handler)
  subscriberCount += 1
  connect()

  return () => {
    listeners[event].delete(handler)
    subscriberCount = Math.max(0, subscriberCount - 1)
    if (subscriberCount === 0) {
      disconnect()
    }
  }
}
