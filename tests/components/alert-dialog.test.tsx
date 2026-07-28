import { describe, expect, it, vi } from "vitest"
import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Ces composants étaient de simples fonctions : toute ref passée était
// silencieusement ignorée et React émettait « Function components cannot be
// given refs ». Radix en passe une à l'overlay (via Presence) pour piloter les
// animations et le verrouillage du focus.
describe("AlertDialog", () => {
  it("transmet la ref à l'élément DOM réel de chaque sous-composant", async () => {
    const contenu = createRef<HTMLDivElement>()
    const titre = createRef<HTMLHeadingElement>()
    const description = createRef<HTMLParagraphElement>()
    const entete = createRef<HTMLDivElement>()
    const pied = createRef<HTMLDivElement>()
    const action = createRef<HTMLButtonElement>()
    const annuler = createRef<HTMLButtonElement>()

    render(
      <AlertDialog open>
        <AlertDialogContent ref={contenu}>
          <AlertDialogHeader ref={entete}>
            <AlertDialogTitle ref={titre}>Supprimer ?</AlertDialogTitle>
            <AlertDialogDescription ref={description}>Action irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter ref={pied}>
            <AlertDialogCancel ref={annuler}>Annuler</AlertDialogCancel>
            <AlertDialogAction ref={action}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    )

    for (const [nom, ref] of [
      ["contenu", contenu],
      ["en-tête", entete],
      ["titre", titre],
      ["description", description],
      ["pied", pied],
      ["annuler", annuler],
      ["action", action],
    ] as const) {
      expect(ref.current, `la ref « ${nom} » doit pointer sur un élément DOM`).toBeInstanceOf(
        HTMLElement,
      )
    }

    expect(titre.current).toHaveTextContent("Supprimer ?")
    expect(action.current?.tagName).toBe("BUTTON")
  })

  it("transmet la ref au déclencheur et l'ouvre au clic", async () => {
    const declencheur = createRef<HTMLButtonElement>()
    const user = userEvent.setup()

    render(
      <AlertDialog>
        <AlertDialogTrigger ref={declencheur}>Ouvrir</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Confirmer</AlertDialogTitle>
          <AlertDialogDescription>Détail</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    )

    expect(declencheur.current).toBeInstanceOf(HTMLElement)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await user.click(declencheur.current!)
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
  })

  // Le symptôme d'origine : React signalait le problème par un avertissement
  // console. Il ne doit plus être émis au rendu du dialogue.
  // À noter : React ne répète pas un avertissement identique. Ce test ne fait
  // donc foi qu'exécuté seul ; ce sont les deux tests de ref ci-dessus qui
  // protègent réellement contre une régression.
  it("n'émet plus l'avertissement React sur les refs", () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Titre</AlertDialogTitle>
          <AlertDialogDescription>Description</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    )

    const avertissements = espion.mock.calls
      .map((appel) => String(appel[0]))
      .filter((message) => message.includes("Function components cannot be given refs"))
    expect(avertissements).toEqual([])

    espion.mockRestore()
  })
})
