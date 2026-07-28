"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Les demandes de confirmation passaient par window.confirm() : une boîte du
// navigateur, non stylée, préfixée du nom de domaine, bloquant tout l'onglet et
// impossible à traduire ou à tester correctement. Ce hook rend exactement le
// même AlertDialog partout, tout en gardant une écriture aussi directe que
// l'ancienne :
//
//   if (!(await demanderConfirmation({ ... }))) return
//
// Le composant appelant doit rendre `dialogueConfirmation` dans son arbre.

export type OptionsConfirmation = {
  /** Titre du dialogue, formulé en question. */
  title: string
  /** Conséquence concrète de l'action, affichée sous le titre. */
  description?: React.ReactNode
  /** Libellé du bouton qui valide. Par défaut « Confirmer ». */
  confirmLabel?: string
  /** Libellé du bouton qui annule. Par défaut « Annuler ». */
  cancelLabel?: string
  /**
   * « danger » colore le bouton de validation en rouge : à réserver aux
   * suppressions et aux actions irréversibles.
   */
  variant?: "default" | "danger"
}

export function useConfirmation() {
  const [demande, setDemande] = React.useState<OptionsConfirmation | null>(null)
  const repondreRef = React.useRef<((accepte: boolean) => void) | null>(null)

  const demanderConfirmation = React.useCallback(
    (options: OptionsConfirmation) =>
      new Promise<boolean>((resolve) => {
        // Une demande déjà ouverte est considérée comme refusée : sans cela sa
        // promesse ne serait jamais résolue et l'appelant resterait bloqué.
        repondreRef.current?.(false)
        repondreRef.current = resolve
        setDemande(options)
      }),
    [],
  )

  const repondre = React.useCallback((accepte: boolean) => {
    repondreRef.current?.(accepte)
    repondreRef.current = null
    setDemande(null)
  }, [])

  // Si le composant disparaît pendant qu'une confirmation est ouverte
  // (navigation, démontage), on refuse pour ne pas laisser la promesse en
  // suspens.
  React.useEffect(() => {
    return () => {
      repondreRef.current?.(false)
      repondreRef.current = null
    }
  }, [])

  const dialogueConfirmation = (
    <AlertDialog
      open={demande !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) repondre(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{demande?.title}</AlertDialogTitle>
          {demande?.description ? (
            <AlertDialogDescription className="whitespace-pre-line">
              {demande.description}
            </AlertDialogDescription>
          ) : (
            // Radix avertit en console si un AlertDialog n'a pas de
            // description : on en fournit une, masquée visuellement.
            <AlertDialogDescription className="sr-only">
              Confirmez ou annulez cette action.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => repondre(false)}>
            {demande?.cancelLabel ?? "Annuler"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => repondre(true)}
            className={
              demande?.variant === "danger"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {demande?.confirmLabel ?? "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { demanderConfirmation, dialogueConfirmation }
}
