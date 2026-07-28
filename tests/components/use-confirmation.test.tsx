import { describe, expect, it } from "vitest"
import { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { useConfirmation } from "@/hooks/use-confirmation"

function Composant() {
  const { demanderConfirmation, dialogueConfirmation } = useConfirmation()
  const [reponse, setReponse] = useState<string>("aucune")

  return (
    <div>
      <button
        onClick={async () => {
          const accepte = await demanderConfirmation({
            title: "Supprimer cette banque ?",
            description: "Banque Centrale sera définitivement supprimée.",
            confirmLabel: "Supprimer",
            variant: "danger",
          })
          setReponse(accepte ? "acceptee" : "refusee")
        }}
      >
        Supprimer
      </button>
      <p>Réponse : {reponse}</p>
      {dialogueConfirmation}
    </div>
  )
}

describe("useConfirmation", () => {
  it("n'affiche rien tant qu'aucune confirmation n'est demandée", () => {
    render(<Composant />)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("résout à vrai quand l'utilisateur valide", async () => {
    const user = userEvent.setup()
    render(<Composant />)

    await user.click(screen.getByRole("button", { name: "Supprimer" }))

    const dialogue = await screen.findByRole("alertdialog")
    expect(dialogue).toHaveTextContent("Supprimer cette banque ?")
    expect(dialogue).toHaveTextContent("Banque Centrale sera définitivement supprimée.")

    // Le libellé du bouton est celui demandé par l'appelant, pas un « OK »
    // imposé par le navigateur comme avec window.confirm(). On cible le bouton
    // du dialogue : celui de la page porte le même libellé.
    await user.click(within(dialogue).getByRole("button", { name: "Supprimer" }))

    expect(await screen.findByText("Réponse : acceptee")).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("résout à faux quand l'utilisateur annule", async () => {
    const user = userEvent.setup()
    render(<Composant />)

    await user.click(screen.getByRole("button", { name: "Supprimer" }))
    await user.click(await screen.findByRole("button", { name: "Annuler" }))

    expect(await screen.findByText("Réponse : refusee")).toBeInTheDocument()
  })

  // Radix ferme le dialogue sur Échap sans passer par les boutons : la promesse
  // doit quand même se résoudre, sinon l'appelant reste bloqué pour de bon.
  it("résout à faux quand le dialogue est fermé par la touche Échap", async () => {
    const user = userEvent.setup()
    render(<Composant />)

    await user.click(screen.getByRole("button", { name: "Supprimer" }))
    await screen.findByRole("alertdialog")
    await user.keyboard("{Escape}")

    expect(await screen.findByText("Réponse : refusee")).toBeInTheDocument()
  })

  it("colore le bouton de validation en rouge pour une action destructive", async () => {
    const user = userEvent.setup()
    render(<Composant />)

    await user.click(screen.getByRole("button", { name: "Supprimer" }))
    const dialogue = await screen.findByRole("alertdialog")

    expect(within(dialogue).getByRole("button", { name: "Supprimer" })).toHaveClass("bg-destructive")
  })
})
