type EventCallback<T = any> = (data: T) => void

type EventType =
  | "bank:created"
  | "bank:updated"
  | "bank:deleted"
  | "card:created"
  | "card:updated"
  | "card:deleted"
  | "location:created"
  | "location:updated"
  | "location:deleted"
  | "movement:created"
  | "movement:updated"
  | "movement:deleted"
  | "user:created"
  | "user:updated"
  | "user:deleted"
  | "role:created"
  | "role:updated"
  | "role:deleted"
  | "config:updated"
  | "data:refresh"

class EventBus {
  private listeners: Map<EventType, Set<EventCallback>> = new Map()

  on(event: EventType, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  emit(event: EventType, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[EventBus] Error in listener for ${event}:`, error)
        }
      })
    }
  }

  off(event: EventType, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const eventBus = new EventBus()
export type { EventType }
