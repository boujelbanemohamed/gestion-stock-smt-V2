import { type NextRequest, NextResponse } from "next/server"
import type { ApiResponse } from "@/lib/api-types"
import { requireAuth } from "@/lib/auth-middleware"
import { signRealtimeTicket } from "@/lib/auth"

// POST /api/events/ticket - Émet un ticket de 60 secondes pour ouvrir la
// connexion SSE de /api/events. Cette route, elle, est appelée normalement
// (en-tête Authorization, comme toute route protégée) : c'est le ticket
// qu'elle renvoie, jamais le vrai jeton d'accès, qui finit dans l'URL
// d'EventSource.

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response

  const ticket = signRealtimeTicket(auth.user.id)

  return NextResponse.json<ApiResponse<{ ticket: string }>>({
    success: true,
    data: { ticket },
  })
}
