import { screen, within } from "@testing-library/react"

// Pendant une seconde après l'ouverture d'une notification, Radix place une
// copie de son texte dans une zone masquée destinée aux lecteurs d'écran
// (un portail rattaché directement à <body>, hors de la zone d'affichage).
// Une recherche globale trouve donc le même texte DEUX fois pendant cette
// seconde, et une seule fois avant et après : selon la vitesse de la machine,
// la même assertion passe ou échoue.
//
// On restreint donc toute recherche portant sur le contenu d'une notification
// à la zone d'affichage, qui ne contient jamais cette copie.
//
// hidden: true est indispensable — quand un dialogue est ouvert, Radix pose
// aria-hidden sur tout le reste de la page, y compris cette zone, qui devient
// alors introuvable par getByRole.
export function notifications() {
  return within(screen.getByRole("region", { name: /notifications/i, hidden: true }))
}
