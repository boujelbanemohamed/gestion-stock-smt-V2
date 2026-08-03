"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ACTIVITY_STORAGE_KEY, logout } from "@/lib/api-client"

// Déconnexion automatique pour inactivité : après `warningMinutes` sans
// activité réelle de l'utilisateur, un avertissement s'affiche avec un
// compte à rebours de `logoutMinutes` avant déconnexion.
//
// Trois contraintes ont dicté cette implémentation :
//
// 1. Synchronisé entre onglets : l'horodatage de la dernière activité vit
//    dans localStorage (pas en mémoire du composant), et l'évènement
//    "storage" propage toute activité d'un onglet vers les autres.
//
// 2. Fiable même onglet en arrière-plan : un simple setTimeout de 15 minutes
//    ne suffit pas — les navigateurs ralentissent les minuteurs des onglets
//    non visibles. On calcule donc le temps écoulé à partir d'une vraie
//    horloge (Date.now() - dernière activité), recalculé à chaque tick ET
//    immédiatement quand l'onglet redevient visible/actif (visibilitychange,
//    focus) : peu importe que le tick ait pris du retard pendant que
//    l'utilisateur était ailleurs, le calcul se corrige tout seul dès qu'on revient.
//
// 3. Seul un clic explicite prolonge la session une fois l'avertissement
//    affiché : on ignore les mouvements de souris ambiants de CET onglet
//    pendant l'avertissement, pour qu'un frôlement accidentel de la souris
//    ne prolonge pas silencieusement une session qu'on voulait terminer.
//    (Une vraie activité dans un AUTRE onglet reste prise en compte : elle
//    met à jour l'horodatage partagé, donc referme aussi l'avertissement ici.)

const STORAGE_KEY = ACTIVITY_STORAGE_KEY
const CHECK_INTERVAL_MS = 1000
const ACTIVITY_WRITE_THROTTLE_MS = 5000
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"] as const

export function useIdleSession(warningMinutes: number, logoutMinutes: number, enabled: boolean) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const warningActiveRef = useRef(false)
  const lastWriteRef = useRef(0)

  const noteActivity = useCallback(() => {
    if (warningActiveRef.current) return
    const now = Date.now()
    if (now - lastWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return
    lastWriteRef.current = now
    localStorage.setItem(STORAGE_KEY, String(now))
  }, [])

  // Appelée par le bouton « Rester connecté » : seul déclencheur qui relance
  // le minuteur pendant que l'avertissement est affiché.
  const extend = useCallback(() => {
    const now = Date.now()
    lastWriteRef.current = now
    localStorage.setItem(STORAGE_KEY, String(now))
    warningActiveRef.current = false
    setSecondsLeft(null)
  }, [])

  useEffect(() => {
    if (!enabled || !warningMinutes || !logoutMinutes) {
      // Referme immédiatement un avertissement déjà affiché si la fonctionnalité
      // vient d'être désactivée (ex. depuis Configuration, dans un autre onglet).
      setSecondsLeft(null)
      return
    }

    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    }

    const warningMs = warningMinutes * 60 * 1000
    const totalMs = warningMs + logoutMinutes * 60 * 1000

    const check = () => {
      const dernier = Number(localStorage.getItem(STORAGE_KEY)) || Date.now()
      const ecoule = Date.now() - dernier

      if (ecoule >= totalMs) {
        warningActiveRef.current = false
        logout()
        return
      }
      if (ecoule >= warningMs) {
        warningActiveRef.current = true
        setSecondsLeft(Math.max(0, Math.ceil((totalMs - ecoule) / 1000)))
      } else {
        warningActiveRef.current = false
        setSecondsLeft(null)
      }
    }

    const intervalle = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener("visibilitychange", check)
    window.addEventListener("focus", check)
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, noteActivity, { passive: true }))

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) check()
    }
    window.addEventListener("storage", onStorage)

    check()

    return () => {
      clearInterval(intervalle)
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("focus", check)
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, noteActivity))
      window.removeEventListener("storage", onStorage)
    }
  }, [enabled, warningMinutes, logoutMinutes, noteActivity])

  return { secondsLeft, extend }
}
