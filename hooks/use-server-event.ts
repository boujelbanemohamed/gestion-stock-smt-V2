"use client"

import { useEffect, useRef } from "react"
import { subscribeToRealtime } from "@/lib/realtime-client"

// S'abonne à un évènement poussé par le serveur (SSE) : "notification" ou "movement".
export function useServerEvent(event: "notification" | "movement", handler: (data: any) => void) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    return subscribeToRealtime(event, (data) => handlerRef.current(data))
  }, [event])
}
