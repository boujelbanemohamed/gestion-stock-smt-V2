"use client"

import { useEffect, useCallback, useState } from "react"
import { eventBus, type EventType } from "@/lib/event-bus"

type EntityName = "banks" | "cards" | "locations" | "movements" | "users" | "roles" | "config"

function entityToEvents(entity: EntityName): EventType[] {
  const eventMap: Record<EntityName, EventType[]> = {
    banks: ["bank:created", "bank:updated", "bank:deleted"],
    cards: ["card:created", "card:updated", "card:deleted"],
    locations: ["location:created", "location:updated", "location:deleted"],
    movements: ["movement:created", "movement:updated", "movement:deleted"],
    users: ["user:created", "user:updated", "user:deleted"],
    roles: ["role:created", "role:updated", "role:deleted"],
    config: ["config:updated"],
  }
  return eventMap[entity] || []
}

export function useDataSync(entities: (EntityName | EventType)[], onSync: () => void) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleSync = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await onSync()
    } finally {
      // Keep the refreshing indicator visible for a brief moment
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }, [onSync])

  useEffect(() => {
    const events: EventType[] = entities.flatMap((item) => {
      // Check if it's an entity name or already an event type
      if (item.includes(":")) {
        return [item as EventType]
      }
      return entityToEvents(item as EntityName)
    })

    const unsubscribers = events.map((event) => eventBus.on(event, handleSync))

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [entities, handleSync])

  return { isRefreshing }
}

export function useAutoRefresh(callback: () => void, interval = 30000) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const wrappedCallback = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await callback()
      setLastRefresh(new Date())
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }, [callback])

  useEffect(() => {
    const timer = setInterval(wrappedCallback, interval)
    return () => clearInterval(timer)
  }, [wrappedCallback, interval])

  return { isRefreshing, lastRefresh }
}
