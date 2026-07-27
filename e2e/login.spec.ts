import { test, expect } from "@playwright/test"
import { ADMIN_EMAIL, login } from "./helpers"

// Ce spec teste le formulaire de connexion lui-même : il démarre donc sans la
// session admin partagée (contrairement au reste de la suite), avec un
// contexte de navigateur "propre" (pas de token en localStorage).
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("Connexion", () => {
  test("affiche une erreur générique avec des identifiants invalides", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("Email").fill(ADMIN_EMAIL)
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe")
    await page.getByRole("button", { name: "Se connecter" }).click()

    await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible()
    await expect(page).toHaveURL("/")
  })

  test("connecte un administrateur et affiche le tableau de bord", async ({ page }) => {
    await login(page)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole("link", { name: /banques/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /mouvements/i })).toBeVisible()
  })

  test("bloque l'accès au tableau de bord sans session (redirection vers la connexion)", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL("/")
    await expect(page.getByLabel("Email")).toBeVisible()
  })
})

test.describe("Mot de passe oublié", () => {
  test("affiche un message générique de confirmation, que le compte existe ou non", async ({ page }) => {
    await page.goto("/")
    await page.getByText("Mot de passe oublié ?").click()
    await page.getByLabel("Email").fill("inconnu@example.com")
    await page.getByRole("button", { name: "Envoyer le lien de réinitialisation" }).click()

    // Anti-énumération : même message générique quel que soit le compte.
    await expect(page.getByText("Si un compte existe avec l'adresse")).toBeVisible()
  })
})
