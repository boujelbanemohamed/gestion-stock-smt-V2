"use client"

// Connexion SSE (Server-Sent Events) partagée côté client : un seul EventSource
// par onglet, quel que soit le nombre de composants abonnés (bell de
// notifications, synchronisation des mouvements, etc.).
//
// EventSource ne permet pas d'en-tête Authorization : l'URL porte donc un
// ticket de 60 secondes (obtenu via /api/events/ticket, appelé normalement
// avec le vrai token en en-tête), jamais le token d'accès lui-même. Et parce
// que ce ticket expire vite, la reconnexion native du navigateur — qui
// rejoue indéfiniment la même URL, donc le même ticket périmé — ne suffit
// plus : sur une erreur, on ferme et on redemande nous-mêmes un ticket frais.

import { authenticatedFetch } from "@/lib/api-client"

type RealtimeEvent = "notification" | "movement"
type RealtimeHandler = (data: any) => void

const listeners: Record<RealtimeEvent, Set<RealtimeHandler>> = {
  notification: new Set(),
  movement: new Set(),
}

const RECONNECT_DELAY_MS = 3000

let eventSource: EventSource | null = null
let subscriberCount = 0
let connecting = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function parseAndDispatch(event: RealtimeEvent, raw: MessageEvent) {
  try {
    const data = JSON.parse(raw.data)
    listeners[event].forEach((handler) => handler(data))
  } catch (error) {
    console.error(`[realtime] Error handling "${event}" event:`, error)
  }
}

async function fetchTicket(): Promise<string | null> {
  try {
    const response = await authenticatedFetch("/api/events/ticket", { method: "POST" })
    if (!response.ok) return null
    const data = await response.json()
    return data.success ? data.data.ticket : null
  } catch {
    return null
  }
}

function scheduleReconnect() {
  if (reconnectTimer || subscriberCount === 0) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, RECONNECT_DELAY_MS)
}

async function connect() {
  if (eventSource || connecting || subscriberCount === 0 || typeof window === "undefined") return
  // Pas de session connue : inutile d'appeler l'API pour se le faire dire.
  if (!localStorage.getItem("accessToken")) return

  connecting = true
  const ticket = await fetchTicket()
  connecting = false

  // L'état a pu changer pendant l'attente du ticket (dernier abonné parti,
  // connexion déjà rétablie par un appel concurrent) : ne rien faire dans ce cas.
  if (subscriberCount === 0 || eventSource) return

  if (!ticket) {
    scheduleReconnect()
    return
  }

  const source = new EventSource(`/api/events?ticket=${encodeURIComponent(ticket)}`)
  source.addEventListener("notification", (e) => parseAndDispatch("notification", e as MessageEvent))
  source.addEventListener("movement", (e) => parseAndDispatch("movement", e as MessageEvent))
  source.addEventListener("error", () => {
    // Le ticket (60s) a pu expirer, ou la connexion a simplement été coupée :
    // la reconnexion native d'EventSource rejouerait sinon indéfiniment la
    // même URL, donc le même ticket périmé. On ferme et on en redemande un frais.
    source.close()
    if (eventSource === source) eventSource = null
    scheduleReconnect()
  })
  eventSource = source
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
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
