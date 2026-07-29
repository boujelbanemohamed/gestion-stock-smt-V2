import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MovementsManagement from "@/components/dashboard/movements-management"
import { Toaster } from "@/components/ui/toaster"
import { notifications } from "../helpers/notifications"

const mockSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}))

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const bankA = { id: "bank-1", name: "Banque Centrale", isActive: true, address: "1 rue de la Banque" }
const locationA = { id: "loc-1", name: "Coffre Principal", bankId: "bank-1", isActive: true }
const locationB = { id: "loc-2", name: "Coffre Secondaire", bankId: "bank-1", isActive: true }
const cardA = {
  id: "card-1",
  name: "Carte Débit Standard",
  bankId: "bank-1",
  type: "Débit",
  subType: "Standard",
  minThreshold: 50,
  maxThreshold: 1000,
  stockLevels: [{ locationId: "loc-1", quantity: 20 }],
}
const movementReasonEntry = { id: "reason-entry", label: "Entrée en stock", isOther: false, isActive: true }
const movementReasonExit = { id: "reason-exit", label: "Expedition Sortie", isOther: false, isActive: true }
const movementReasonOther = { id: "reason-other", label: "Autre", isOther: true, isActive: true }

const movementA = {
  id: "mvt-1",
  reference: "BM-20260115-K7RM2P",
  cardId: "card-1",
  fromLocationId: null,
  toLocationId: "loc-1",
  movementType: "entry",
  quantity: 10,
  reason: "Réapprovisionnement",
  userId: "user-1",
  createdAt: new Date("2026-01-15T10:30:00Z").toISOString(),
  documentUrl: null,
  user: { firstName: "Jane", lastName: "Doe" },
}

function setupFetchMock(
  movements: any[] = [movementA],
  extra: {
    total?: number
    totalPages?: number
    postResponse?: unknown
    deleteResponse?: unknown
    reasons?: unknown[]
  } = {},
) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.startsWith("/api/movements/") && options?.method === "DELETE") {
      return jsonResponse(extra.deleteResponse ?? { success: true })
    }
    if (url === "/api/movements" && options?.method === "POST") {
      return jsonResponse(extra.postResponse ?? { success: true, data: { ...movementA, id: "mvt-new" } })
    }
    if (url === "/api/movements/upload" && options?.method === "POST") {
      return jsonResponse({ success: true, data: { url: "/uploads/justificatif.pdf", name: "justificatif.pdf" } })
    }
    if (url.startsWith("/api/movements?")) {
      return jsonResponse({
        success: true,
        data: {
          movements,
          total: extra.total ?? movements.length,
          totalPages: extra.totalPages ?? 1,
        },
      })
    }
    if (url.startsWith("/api/cards")) return jsonResponse({ success: true, data: [cardA] })
    if (url.startsWith("/api/locations")) return jsonResponse({ success: true, data: [locationA, locationB] })
    if (url.startsWith("/api/banks")) return jsonResponse({ success: true, data: [bankA] })
    if (url.startsWith("/api/movement-reasons")) {
      return jsonResponse({
        success: true,
        data: extra.reasons ?? [movementReasonEntry, movementReasonExit, movementReasonOther],
      })
    }
    if (url.startsWith("/api/config")) return jsonResponse({ success: true, data: { general: { logo: "" } } })
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

async function openNewMovementDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Nouveau mouvement" }))
  const dialog = screen.getByRole("dialog")
  await within(dialog).findByRole("heading", { name: "Nouveau Mouvement" })
  return dialog
}

async function selectBank(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.click(within(dialog).getAllByRole("combobox")[0])
  await user.click(await screen.findByRole("option", { name: bankA.name }))
}

async function selectMovementType(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  type: "Entrée" | "Sortie" | "Transfert",
) {
  await user.click(within(dialog).getAllByRole("combobox")[1])
  await user.click(await screen.findByRole("option", { name: type }))
}

// L'emplacement source (De) n'est rendu que pour Sortie/Transfert, toujours en
// 3e position (après Banque et Type).
async function selectFromLocation(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string) {
  await user.click(within(dialog).getAllByRole("combobox")[2])
  await user.click(await screen.findByRole("option", { name }))
}

// L'emplacement destination (Vers) est toujours le dernier combobox affiché :
// seul pour Entrée (index 2), après l'emplacement source pour Transfert (index 3).
async function selectToLocation(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string) {
  const comboboxes = within(dialog).getAllByRole("combobox")
  await user.click(comboboxes[comboboxes.length - 1])
  await user.click(await screen.findByRole("option", { name }))
}

describe("MovementsManagement", () => {
  beforeEach(() => {
    mockSearchParams.delete("cardId")
    localStorage.setItem("currentUser", JSON.stringify({ id: "user-1", firstName: "Jane", lastName: "Doe" }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it("affiche un message quand aucun mouvement n'existe", async () => {
    setupFetchMock([])
    render(<MovementsManagement />)

    expect(await screen.findByText("Aucun mouvement")).toBeInTheDocument()
  })

  it("charge et affiche les mouvements avec leurs informations associées", async () => {
    setupFetchMock()
    render(<MovementsManagement />)

    expect(await screen.findByText("Carte Débit Standard")).toBeInTheDocument()
    expect(await screen.findByText("Banque Centrale")).toBeInTheDocument()
    expect(await screen.findByText("Coffre Principal")).toBeInTheDocument()
    expect(screen.getByText("Entrée")).toBeInTheDocument()
    expect(screen.getByText("Réapprovisionnement")).toBeInTheDocument()
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
  })

  it("réinitialise les filtres au clic sur Réinitialiser", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    await user.type(screen.getByLabelText(/recherche/i), "test")
    fetchMock.mockClear()

    await user.click(screen.getByRole("button", { name: /^réinitialiser$/i }))

    // Le rechargement se fait avec des filtres remis à zéro (pas de searchTerm).
    const calledUrls = fetchMock.mock.calls.map((c) => c[0] as string)
    const lastMovementsCall = calledUrls.filter((u) => u.startsWith("/api/movements?")).pop()
    expect(lastMovementsCall).not.toContain("searchTerm")
  })

  it("demande confirmation avant de supprimer, en avertissant de l'impact sur le stock", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    await user.click(screen.getByRole("button", { name: /supprimer le mouvement/i }))

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/irréversible et modifie le stock/i)).toBeInTheDocument()
    // Rien n'est supprimé tant que l'utilisateur n'a pas confirmé.
    expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit)?.method === "DELETE")).toBe(false)
  })

  // Le pop-up doit dire quelle quantité part de quel emplacement, sans quoi
  // l'utilisateur confirme sans savoir ce que la suppression va faire au stock.
  // Les trois formulations doivent correspondre à ce que fait réellement l'API :
  // entrée -> retrait à la destination, sortie -> retour à la source,
  // transfert -> retour de la destination vers la source.
  it.each([
    [
      "une ENTRÉE : retrait à la destination",
      { movementType: "entry", quantity: 23, fromLocationId: null, toLocationId: "loc-1" },
      /23 cartes vont être retirées de « Coffre Principal »/i,
    ],
    [
      "une SORTIE : retour à la source",
      { movementType: "exit", quantity: 15, fromLocationId: "loc-1", toLocationId: null },
      /15 cartes vont être remises dans « Coffre Principal »/i,
    ],
    [
      "un TRANSFERT : retour de la destination vers la source",
      { movementType: "transfer", quantity: 10, fromLocationId: "loc-1", toLocationId: "loc-2" },
      /10 cartes vont être transférées de « Coffre Secondaire » vers « Coffre Principal »/i,
    ],
  ])("annonce l'effet exact sur le stock pour %s", async (_libelle, champs, attendu) => {
    setupFetchMock([{ ...movementA, ...champs }])
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    await user.click(screen.getByRole("button", { name: /supprimer le mouvement/i }))

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("Effet sur le stock")).toBeInTheDocument()
    expect(within(dialog).getByText(attendu)).toBeInTheDocument()
  })

  it("met la quantité au singulier quand il n'y a qu'une seule carte", async () => {
    setupFetchMock([{ ...movementA, quantity: 1, movementType: "entry", toLocationId: "loc-1" }])
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    await user.click(screen.getByRole("button", { name: /supprimer le mouvement/i }))

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/1 carte va être retirée de « Coffre Principal »/i)).toBeInTheDocument()
  })

  it("annule la suppression sans rien envoyer si l'utilisateur renonce", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    await user.click(screen.getByRole("button", { name: /supprimer le mouvement/i }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }))

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit)?.method === "DELETE")).toBe(false)
  })

  it("supprime le mouvement après confirmation et signale le réajustement du stock", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <MovementsManagement />
      </>,
    )
    await screen.findByText("Carte Débit Standard")

    await user.click(screen.getByRole("button", { name: /supprimer le mouvement/i }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: /supprimer définitivement/i }))

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "DELETE")
      expect(deleteCall).toBeTruthy()
      expect(deleteCall![0]).toBe(`/api/movements/${movementA.id}`)
    })

    expect(await notifications().findByText("Mouvement supprimé")).toBeInTheDocument()
    expect(screen.getByText(/stock a été réajusté/i)).toBeInTheDocument()
  })

  it("affiche le refus du serveur quand l'annulation rendrait le stock négatif", async () => {
    setupFetchMock([movementA], {
      deleteResponse: { success: false, error: "Annuler ce mouvement rendrait le stock négatif" },
    })
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <MovementsManagement />
      </>,
    )
    await screen.findByText("Carte Débit Standard")

    await user.click(screen.getByRole("button", { name: /supprimer le mouvement/i }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: /supprimer définitivement/i }))

    expect(await notifications().findByText("Suppression impossible")).toBeInTheDocument()
    // Formulation propre au message du serveur (le pop-up en emploie une autre).
    expect(notifications().getByText(/Annuler ce mouvement rendrait/i)).toBeInTheDocument()
  })

  it("affiche une erreur de validation quand aucune carte n'est sélectionnée", async () => {
    setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <MovementsManagement />
      </>,
    )
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await selectBank(user, dialog)

    // Type "Entrée" par défaut : le bouton n'est pas désactivé (isStockSufficient()
    // est trivialement vrai hors Sortie/Transfert), donc ce chemin de validation
    // est bien atteignable via un vrai clic.
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }))

    expect(await screen.findByText("Veuillez sélectionner au moins une carte")).toBeInTheDocument()
  })

  it("désactive le bouton d'enregistrement quand le stock est insuffisant pour une sortie", async () => {
    setupFetchMock()
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await selectBank(user, dialog)
    await selectMovementType(user, dialog, "Sortie")
    await selectFromLocation(user, dialog, locationA.name)

    await user.click(within(dialog).getByLabelText(new RegExp(cardA.name)))
    const quantityInput = within(dialog).getByLabelText(/quantité pour cette carte/i)
    // Champ contrôlé : onChange retombe sur 1 si la valeur est vide, donc un
    // clear()+type() classique se retrouve à ajouter "999" après ce "1" résiduel.
    // Un seul événement change avec la valeur finale évite ce piège.
    fireEvent.change(quantityInput, { target: { value: "999" } })

    const submitButton = await within(dialog).findByRole("button", { name: "Stock insuffisant" })
    expect(submitButton).toBeDisabled()
  })

  it("affiche une erreur de validation quand la source et la destination d'un transfert sont identiques", async () => {
    setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <MovementsManagement />
      </>,
    )
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await selectBank(user, dialog)
    await selectMovementType(user, dialog, "Transfert")
    await selectFromLocation(user, dialog, locationA.name)
    await selectToLocation(user, dialog, locationA.name)

    await user.click(within(dialog).getByLabelText(new RegExp(cardA.name)))
    await user.click(within(dialog).getByLabelText(movementReasonExit.label))

    // Quantité par défaut (1) reste sous le stock disponible (20) : le bouton
    // n'est donc pas désactivé et la validation "même emplacement" est atteignable.
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }))

    // Le message apparaît deux fois (source ET destination) dans la liste d'erreurs.
    const messages = await screen.findAllByText(/doivent être différents/i)
    expect(messages.length).toBeGreaterThan(0)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("crée un mouvement de sortie avec succès et affiche la confirmation", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <MovementsManagement />
      </>,
    )
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await selectBank(user, dialog)
    await selectMovementType(user, dialog, "Sortie")
    await selectFromLocation(user, dialog, locationA.name)

    await user.click(within(dialog).getByLabelText(new RegExp(cardA.name)))
    const quantityInput = within(dialog).getByLabelText(/quantité pour cette carte/i)
    fireEvent.change(quantityInput, { target: { value: "5" } })

    await user.click(within(dialog).getByLabelText(movementReasonExit.label))

    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (c) => c[0] === "/api/movements" && (c[1] as RequestInit)?.method === "POST",
      )
      expect(postCall).toBeTruthy()
    })

    const postCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/movements" && (c[1] as RequestInit)?.method === "POST",
    )!
    const body = JSON.parse((postCall[1] as RequestInit).body as string)
    expect(body).toMatchObject({
      cardId: "card-1",
      quantity: 5,
      movementType: "exit",
      fromLocationId: "loc-1",
      toLocationId: null,
    })

    expect(await screen.findByText("Mouvement créé", { exact: true })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  // Objectif de la fonctionnalité : l'utilisateur ne saisit plus le motif.
  // Les motifs typés viennent de Configuration > Motifs.
  const motifsTypes = [
    { ...movementReasonEntry, movementType: "entry" },
    { ...movementReasonExit, movementType: "exit" },
    movementReasonOther,
  ]

  it("affiche le numéro de bordereau dans la liste", async () => {
    setupFetchMock([movementA])
    render(<MovementsManagement />)

    expect(await screen.findByText("BM-20260115-K7RM2P")).toBeInTheDocument()
  })

  // Les mouvements antérieurs à la mise en place du numéro n'en ont pas : la
  // colonne doit le dire, sans laisser une cellule vide qui ferait douter.
  it("marque d'un tiret un mouvement sans numéro", async () => {
    const { reference, ...sansReference } = movementA
    setupFetchMock([sansReference as typeof movementA])
    render(<MovementsManagement />)

    await screen.findByText("Carte Débit Standard")
    expect(screen.queryByText("BM-20260115-K7RM2P")).not.toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("permet de rechercher par numéro de bordereau", async () => {
    const fetchMock = setupFetchMock([movementA])
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    await user.type(screen.getByLabelText("Recherche"), "BM-20260115-K7RM2P")

    await waitFor(() => {
      const appel = fetchMock.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("searchTerm=BM-20260115-K7RM2P"),
      )
      expect(appel).toBeTruthy()
    })
  })

  it("coche d'office le motif configuré pour le type sélectionné", async () => {
    setupFetchMock([movementA], { reasons: motifsTypes })
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    // Le type par défaut est Entrée : son motif doit être coché dès l'ouverture,
    // sans aucune action de l'utilisateur.
    const dialog = await openNewMovementDialog(user)
    await waitFor(() =>
      expect(within(dialog).getByLabelText(movementReasonEntry.label)).toBeChecked(),
    )

    await selectMovementType(user, dialog, "Sortie")
    await waitFor(() => expect(within(dialog).getByLabelText(movementReasonExit.label)).toBeChecked())
    expect(within(dialog).getByLabelText(movementReasonEntry.label)).not.toBeChecked()
  })

  it("laisse l'utilisateur remplacer le motif pré-sélectionné", async () => {
    setupFetchMock([movementA], { reasons: motifsTypes })
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await waitFor(() =>
      expect(within(dialog).getByLabelText(movementReasonEntry.label)).toBeChecked(),
    )

    await user.click(within(dialog).getByLabelText(movementReasonExit.label))

    expect(within(dialog).getByLabelText(movementReasonExit.label)).toBeChecked()
    expect(within(dialog).getByLabelText(movementReasonEntry.label)).not.toBeChecked()
  })

  it("n'en coche aucun pour un type sans motif configuré", async () => {
    setupFetchMock([movementA], { reasons: motifsTypes })
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    // Transfert n'a pas de motif attribué : le choix reste explicite.
    await selectMovementType(user, dialog, "Transfert")

    await waitFor(() =>
      expect(within(dialog).getByLabelText(movementReasonEntry.label)).not.toBeChecked(),
    )
    expect(within(dialog).getByLabelText(movementReasonExit.label)).not.toBeChecked()
    expect(within(dialog).getByLabelText(movementReasonOther.label)).not.toBeChecked()
  })

  // Sans motif configuré, l'écran doit se comporter exactement comme avant.
  it("ne coche rien quand aucun motif ne porte de type", async () => {
    setupFetchMock([movementA])
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await selectMovementType(user, dialog, "Sortie")

    expect(within(dialog).getByLabelText(movementReasonExit.label)).not.toBeChecked()
  })

  it("enregistre le motif pré-sélectionné avec le mouvement, sans intervention", async () => {
    const fetchMock = setupFetchMock([movementA], { reasons: motifsTypes })
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await selectBank(user, dialog)
    await selectToLocation(user, dialog, locationA.name)
    await user.click(within(dialog).getByLabelText(new RegExp(cardA.name)))

    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (c) => c[0] === "/api/movements" && (c[1] as RequestInit)?.method === "POST",
      )
      expect(postCall).toBeTruthy()
      // Le motif est envoyé en TEXTE : c'est cette copie qui fige le bordereau.
      expect(JSON.parse((postCall![1] as RequestInit).body as string).reason).toBe(
        movementReasonEntry.label,
      )
    })
  })

  it("génère en masse les mouvements pour les cartes en stock dans l'emplacement source", async () => {
    setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <MovementsManagement />
      </>,
    )
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await selectBank(user, dialog)
    await selectMovementType(user, dialog, "Sortie")
    await selectFromLocation(user, dialog, locationA.name)

    await user.click(within(dialog).getByRole("button", { name: /générer en masse/i }))

    // Le compte rendu s'affiche dans une notification de la plateforme, plus
    // dans un alert() du navigateur.
    expect(await notifications().findByText("1 carte(s) sélectionnée(s)")).toBeInTheDocument()
    const quantityInput = await within(dialog).findByLabelText(/quantité pour cette carte/i)
    expect(quantityInput).toHaveValue(20)
  })

  // Le bouton agit sur la liste des cartes : sa place est dans ce groupe de
  // champs, au-dessus de la liste. Auparavant il était centré sur toute la
  // largeur du formulaire, hors de la grille libellé/champ.
  it("place le bouton de génération en masse dans le groupe Cartes, avant la liste", async () => {
    setupFetchMock()
    const user = userEvent.setup()
    render(<MovementsManagement />)
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await selectBank(user, dialog)
    await selectMovementType(user, dialog, "Sortie")
    await selectFromLocation(user, dialog, locationA.name)

    const bouton = await within(dialog).findByRole("button", { name: /générer en masse/i })
    const caseCarte = within(dialog).getByLabelText(new RegExp(cardA.name))

    // Même colonne de champs que la liste des cartes...
    const colonne = bouton.closest("div.col-span-3")
    expect(colonne).not.toBeNull()
    expect(colonne).toContainElement(caseCarte)

    // ...et positionné avant elle dans le document.
    expect(bouton.compareDocumentPosition(caseCarte) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("téléverse un document justificatif et l'associe au mouvement d'entrée créé", async () => {
    const fetchMock = setupFetchMock()
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <MovementsManagement />
      </>,
    )
    await screen.findByText("Carte Débit Standard")

    const dialog = await openNewMovementDialog(user)
    await selectBank(user, dialog)
    // Type "Entrée" par défaut : seul l'emplacement destination est affiché.
    await selectToLocation(user, dialog, locationA.name)

    await user.click(within(dialog).getByLabelText(new RegExp(cardA.name)))
    await user.click(within(dialog).getByLabelText(movementReasonEntry.label))

    const file = new File(["contenu"], "justificatif.pdf", { type: "application/pdf" })
    const fileInput = within(dialog).getByLabelText("Document")
    await user.upload(fileInput, file)

    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      const uploadCall = fetchMock.mock.calls.find((c) => c[0] === "/api/movements/upload")
      expect(uploadCall).toBeTruthy()
    })

    const postCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/movements" && (c[1] as RequestInit)?.method === "POST",
    )!
    const body = JSON.parse((postCall[1] as RequestInit).body as string)
    expect(body).toMatchObject({
      documentUrl: "/uploads/justificatif.pdf",
      documentName: "justificatif.pdf",
    })

    expect(await screen.findByText("Mouvement créé", { exact: true })).toBeInTheDocument()
  })
})
