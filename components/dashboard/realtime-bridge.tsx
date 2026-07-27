"use client"

import { useServerEvent } from "@/hooks/use-server-event"
import { eventBus } from "@/lib/event-bus"

// Relie le flux SSE serveur (mouvements créés/supprimés par n'importe quel
// utilisateur) au bus d'évènements local du navigateur, déjà utilisé par
// useDataSync sur les pages Mouvements et Tableau de bord. Ainsi, ces pages
// se rafraîchissent en temps réel sans code supplémentaire de leur côté.
export default function RealtimeBridge() {
  useServerEvent("movement", (payload: { action?: string }) => {
    const event =
      payload?.action === "deleted"
        ? "movement:deleted"
        : payload?.action === "updated"
          ? "movement:updated"
          : "movement:created"
    eventBus.emit(event, payload)
  })

  return null
}
