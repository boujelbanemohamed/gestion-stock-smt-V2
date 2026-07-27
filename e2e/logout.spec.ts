import { test, expect } from "@playwright/test"

// Réutilise la session admin partagée (voir playwright.config.ts /
// e2e/global-setup.ts) : pas besoin de repasser par le formulaire de
// connexion, donc aucune requête supplémentaire vers /api/auth/login.
test("la déconnexion ramène à l'écran de connexion", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/dashboard/)

  await page.getByRole("button", { name: "Déconnexion" }).first().click()

  await expect(page).toHaveURL("/")
  await expect(page.getByLabel("Email")).toBeVisible()
})
