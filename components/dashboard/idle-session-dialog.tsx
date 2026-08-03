"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useIdleSession } from "@/hooks/use-idle-session"

function formatDecompte(secondes: number): string {
  const m = Math.floor(secondes / 60)
  const s = secondes % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Avertissement de déconnexion pour inactivité, monté une fois pour toute la
 * zone connectée (voir app/dashboard/layout.tsx). Ne se ferme que par un clic
 * explicite sur « Rester connecté » — jamais par Échap ou un clic à
 * l'extérieur, pour qu'un geste involontaire ne prolonge pas silencieusement
 * une session qu'on voulait terminer.
 */
export function IdleSessionDialog({
  warningMinutes,
  logoutMinutes,
  enabled,
}: {
  warningMinutes: number
  logoutMinutes: number
  enabled: boolean
}) {
  const { secondsLeft, extend } = useIdleSession(warningMinutes, logoutMinutes, enabled)

  return (
    <AlertDialog open={secondsLeft !== null}>
      {/* AlertDialog ne se ferme déjà pas au clic extérieur (comportement Radix
          natif) — seule la touche Échap doit être neutralisée ici. */}
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Votre session va être déconnectée</AlertDialogTitle>
          <AlertDialogDescription>
            Par mesure de sécurité, vous allez être déconnecté dans{" "}
            <span className="font-semibold tabular-nums">
              {secondsLeft !== null ? formatDecompte(secondsLeft) : "0:00"}
            </span>{" "}
            en raison d'une période d'inactivité.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogAction onClick={extend}>Rester connecté</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  )
}
