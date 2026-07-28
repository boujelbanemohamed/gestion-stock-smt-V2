import { screen, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"

// Les confirmations passaient par window.confirm(), qu'on remplaçait par un
// espion. Elles passent maintenant par useConfirmation(), qui rend un
// AlertDialog : les tests cliquent donc sur un vrai bouton, comme l'utilisateur.
// Le `within` est indispensable — le bouton de la ligne du tableau porte souvent
// le même libellé que celui du dialogue.

export async function repondreConfirmation(
  user: UserEvent,
  libelleBouton: string | RegExp,
) {
  const dialogue = await screen.findByRole("alertdialog")
  await user.click(within(dialogue).getByRole("button", { name: libelleBouton }))
}

export async function annulerConfirmation(user: UserEvent) {
  await repondreConfirmation(user, /^annuler$/i)
}
