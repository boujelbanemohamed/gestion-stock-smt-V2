import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

const logoutMock = vi.fn()
vi.mock("@/lib/api-client", () => ({
  logout: () => logoutMock(),
  ACTIVITY_STORAGE_KEY: "lastActivityAt",
}))

import { IdleSessionDialog } from "@/components/dashboard/idle-session-dialog"

// 15 minutes d'avertissement + 5 minutes de compte à rebours, comme les
// valeurs par défaut réelles — plus simples à vérifier avec des minuteurs
// simulés que les vrais réglages configurables.
const AVERTISSEMENT_MIN = 15
const DECONNEXION_MIN = 5

// vi.useFakeTimers() remplace aussi le setTimeout que Testing Library utilise
// en interne pour son propre polling (findBy*/waitFor) : les requêtes async
// n'aboutiraient donc jamais sans avancer nous-mêmes l'horloge simulée à
// chaque étape. On avance le temps avec advanceTimersByTimeAsync (qui laisse
// React traiter les mises à jour d'état déclenchées par le minuteur), puis on
// interroge le DOM avec les requêtes SYNCHRONES (getBy*/queryBy*), jamais
// findBy*, qui attendraient un temps réel qui ne s'écoule jamais ici.
async function avancer(minutes: number) {
  await vi.advanceTimersByTimeAsync(minutes * 60 * 1000)
}

describe("IdleSessionDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    logoutMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it("n'affiche rien tant que le délai d'inactivité n'est pas écoulé", async () => {
    render(<IdleSessionDialog enabled warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />)
    await avancer(AVERTISSEMENT_MIN - 1)

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(logoutMock).not.toHaveBeenCalled()
  })

  it("affiche l'avertissement avec le compte à rebours une fois le délai d'inactivité écoulé", async () => {
    render(<IdleSessionDialog enabled warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />)
    await avancer(AVERTISSEMENT_MIN)

    const dialogue = screen.getByRole("alertdialog")
    expect(dialogue).toHaveTextContent("Votre session va être déconnectée")
    expect(dialogue).toHaveTextContent("5:00")
  })

  it("le compte à rebours diminue avec le temps", async () => {
    render(<IdleSessionDialog enabled warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />)
    await avancer(AVERTISSEMENT_MIN)
    await vi.advanceTimersByTimeAsync(30 * 1000)

    expect(screen.getByRole("alertdialog")).toHaveTextContent("4:30")
  })

  it("déconnecte automatiquement une fois le compte à rebours écoulé", async () => {
    render(<IdleSessionDialog enabled warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />)
    await avancer(AVERTISSEMENT_MIN)
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    await avancer(DECONNEXION_MIN)
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  // Le garde-fou explicitement demandé : un simple mouvement de souris pendant
  // que l'avertissement est affiché ne doit pas le prolonger silencieusement.
  it("ignore un mouvement de souris pendant que l'avertissement est affiché", async () => {
    render(<IdleSessionDialog enabled warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />)
    await avancer(AVERTISSEMENT_MIN)
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    fireEvent.mouseMove(window)
    await avancer(DECONNEXION_MIN)

    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  it("le clic sur « Rester connecté » referme l'avertissement et relance le délai complet", async () => {
    render(<IdleSessionDialog enabled warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />)
    await avancer(AVERTISSEMENT_MIN)
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Rester connecté" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    // Le délai complet doit repartir de zéro : à quelques secondes du terme
    // initial (qui aurait déclenché la déconnexion sans le clic), rien ne
    // s'est encore passé.
    await avancer(AVERTISSEMENT_MIN - 1)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(logoutMock).not.toHaveBeenCalled()
  })

  // Synchronisation entre onglets : une activité détectée dans un autre onglet
  // (relayée par l'évènement "storage") referme l'avertissement affiché ici,
  // sans qu'il soit nécessaire de cliquer dans CET onglet.
  it("referme l'avertissement quand une activité est signalée par un autre onglet", async () => {
    render(<IdleSessionDialog enabled warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />)
    await avancer(AVERTISSEMENT_MIN)
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    localStorage.setItem("lastActivityAt", String(Date.now()))
    fireEvent(window, new StorageEvent("storage", { key: "lastActivityAt" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  // Réglable dans Configuration > Sécurité : désactiver la fonctionnalité doit
  // neutraliser complètement le minuteur, même après un très long délai.
  it("ne fait jamais rien quand la fonctionnalité est désactivée", async () => {
    render(<IdleSessionDialog enabled={false} warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />)
    await avancer(AVERTISSEMENT_MIN + DECONNEXION_MIN + 10)

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(logoutMock).not.toHaveBeenCalled()
  })

  // Si la fonctionnalité est désactivée pendant que l'avertissement est déjà
  // affiché (ex. un administrateur la désactive depuis un autre onglet), il
  // doit se refermer immédiatement plutôt que de rester affiché indéfiniment.
  it("referme un avertissement déjà affiché si la fonctionnalité est désactivée en cours de route", async () => {
    const { rerender } = render(
      <IdleSessionDialog enabled warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />,
    )
    await avancer(AVERTISSEMENT_MIN)
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    rerender(<IdleSessionDialog enabled={false} warningMinutes={AVERTISSEMENT_MIN} logoutMinutes={DECONNEXION_MIN} />)

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
