import { EventEmitter } from "events"

// Bus d'évènements côté serveur, utilisé pour pousser en temps réel (SSE) les
// notifications et mouvements vers les clients connectés, à la place du
// polling. Repose sur un unique process Node long-vivant (comme le reste de
// l'application, ex. lib/db.ts) : ne fonctionnerait pas tel quel derrière des
// fonctions serverless multi-instances.
const globalForEvents = global as unknown as { serverEvents?: EventEmitter }

export const serverEvents: EventEmitter = globalForEvents.serverEvents ?? new EventEmitter()
// Un nombre potentiellement important de clients SSE peuvent s'abonner en parallèle.
serverEvents.setMaxListeners(0)

if (process.env.NODE_ENV !== "production") {
  globalForEvents.serverEvents = serverEvents
}
