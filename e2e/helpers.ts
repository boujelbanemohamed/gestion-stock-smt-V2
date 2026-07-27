import path from "node:path"
import type { Page } from "@playwright/test"

export const ADMIN_EMAIL = "admin@monetique.tn"
export const ADMIN_PASSWORD = "password123"

// Session admin partagée, générée une seule fois par e2e/global-setup.ts et
// réutilisée par les specs qui n'ont pas besoin de tester le formulaire de
// connexion lui-même (voir global-setup.ts pour le détail du raisonnement
// autour du rate limiter de /api/auth/login).
export const AUTH_STATE_PATH = path.join(__dirname, ".auth", "admin.json")

// Se connecte réellement via le formulaire (à utiliser uniquement dans les
// specs qui testent le flux de connexion lui-même : chaque appel consomme une
// requête du quota du rate limiter de /api/auth/login).
export async function login(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto("/")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Mot de passe").fill(password)
  await page.getByRole("button", { name: "Se connecter" }).click()
  await page.waitForURL("**/dashboard")
}
