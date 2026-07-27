import { test, expect } from "@playwright/test"

// Réutilise la session admin partagée (voir playwright.config.ts /
// e2e/global-setup.ts) : ce spec n'a pas besoin de repasser par le formulaire
// de connexion.

// Données issues de prisma/seed.ts : banque, emplacement et carte appartenant
// tous à la même banque ("Banque Centrale de Tunisie"), pour un mouvement
// d'entrée valide de bout en bout.
const BANK_NAME = "Banque Centrale de Tunisie"
const LOCATION_NAME = "Entrepôt Principal - Tunis"
const CARD_NAME = "Carte Visa Classic"
const REASON_LABEL = "Entrée en stock"

test.describe("Mouvements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/movements")
    await expect(page.getByRole("button", { name: "Nouveau mouvement" })).toBeVisible()
  })

  test("crée un mouvement d'entrée de bout en bout et l'affiche dans la liste", async ({ page }) => {
    await page.getByRole("button", { name: "Nouveau mouvement" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Nouveau Mouvement" })).toBeVisible()

    // 1. Banque
    await dialog.getByRole("combobox").first().click()
    await page.getByRole("option", { name: BANK_NAME }).click()

    // 2. Type de mouvement : "Entrée" est déjà la valeur par défaut.

    // 3. Emplacement destination (uniquement affiché pour Entrée/Transfert)
    await dialog.getByRole("combobox").filter({ hasText: /emplacement destination/i }).click()
    await page.getByRole("option", { name: LOCATION_NAME }).click()

    // 4. Sélection de la carte + quantité
    await dialog.getByLabel(new RegExp(CARD_NAME)).check()
    const quantityInput = dialog.locator('input[id^="quantity-"]')
    await quantityInput.fill("5")

    // 5. Motif
    await dialog.getByLabel(REASON_LABEL).check()

    // 6. Enregistrement
    await dialog.getByRole("button", { name: "Enregistrer" }).click()

    await expect(page.getByText("Mouvement créé", { exact: true })).toBeVisible()
    await expect(dialog).not.toBeVisible()

    // Le mouvement fraîchement créé doit apparaître dans le tableau.
    const row = page.getByRole("row").filter({ hasText: CARD_NAME }).first()
    await expect(row).toBeVisible()
    await expect(row.getByText("Entrée", { exact: true })).toBeVisible()
  })

  test("affiche la liste des mouvements existants (seedés)", async ({ page }) => {
    await expect(page.getByRole("table")).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Carte" })).toBeVisible()
  })
})
