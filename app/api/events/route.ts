import type { NextRequest } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { serverEvents } from "@/lib/server-events"

// GET /api/events - Flux SSE (Server-Sent Events) : pousse en temps réel les
// notifications et les mouvements aux clients connectés, en remplacement du
// polling utilisé jusqu'ici.

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const encoder = new TextEncoder()
const HEARTBEAT_INTERVAL_MS = 25000

export async function GET(request: NextRequest) {
  // EventSource (API navigateur) ne permet pas d'ajouter un header Authorization :
  // le token est donc transmis en paramètre de requête, uniquement pour ce endpoint.
  const token = request.nextUrl.searchParams.get("token")
  if (!token) {
    return new Response("Authentification requise", { status: 401 })
  }

  let userId: string
  try {
    userId = verifyAccessToken(token).userId
  } catch {
    return new Response("Token invalide ou expiré", { status: 401 })
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Le flux est déjà fermé (client déconnecté) : rien à faire.
        }
      }

      const onNotification = (notification: any) => {
        // Une notification ciblée (userId défini) n'est envoyée qu'à son destinataire ;
        // une notification globale (userId absent) est diffusée à tous les clients connectés.
        if (!notification.userId || notification.userId === userId) {
          send("notification", notification)
        }
      }

      const onMovement = (payload: any) => send("movement", payload)

      serverEvents.on("notification", onNotification)
      serverEvents.on("movement", onMovement)

      const heartbeat = setInterval(() => send("ping", { t: Date.now() }), HEARTBEAT_INTERVAL_MS)

      const cleanup = () => {
        clearInterval(heartbeat)
        serverEvents.off("notification", onNotification)
        serverEvents.off("movement", onMovement)
      }

      request.signal.addEventListener("abort", () => {
        cleanup()
        try {
          controller.close()
        } catch {
          // déjà fermé
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
