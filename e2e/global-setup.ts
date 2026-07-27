import { chromium, request, type FullConfig } from "@playwright/test"
import { ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_STATE_PATH } from "./helpers"

// S'authentifie UNE SEULE FOIS pour toute la suite, via l'API directement
// (pas de rendu de page), puis sauvegarde la session (tokens + utilisateur en
// localStorage) dans un fichier réutilisé par tous les specs qui n'ont pas
// besoin de tester le formulaire de connexion lui-même.
//
// Pourquoi : /api/auth/login est protégé par un rate limiter (5 requêtes par
// 15 minutes par IP). Si chaque test se reconnectait individuellement, la
// suite entière dépasserait ce quota et échouerait de façon non représentative
// d'un vrai bug. Un seul login partagé garde le budget de requêtes très bas.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL as string

  const apiContext = await request.newContext({ baseURL })
  const response = await apiContext.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  const body = await response.json()
  if (!body.success) {
    throw new Error(
      `[global-setup] Échec de la connexion admin (${ADMIN_EMAIL}) : ${body.error || "réponse inattendue"}. ` +
        `Vérifiez que la base de données de test est bien seedée (npm run db:seed).`,
    )
  }
  await apiContext.dispose()

  const { accessToken, refreshToken, user } = body.data

  // Voir playwright.config.ts : même logique de sélection du navigateur
  // (Chrome déjà installé par défaut, ou un binaire précis via
  // PLAYWRIGHT_CHROMIUM_PATH).
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : { channel: "chrome" },
  )
  const page = await browser.newPage({ baseURL })
  await page.goto("/")
  await page.evaluate(
    ({ accessToken, refreshToken, user }) => {
      localStorage.setItem("accessToken", accessToken)
      localStorage.setItem("refreshToken", refreshToken)
      localStorage.setItem("currentUser", JSON.stringify(user))
    },
    { accessToken, refreshToken, user },
  )
  await page.context().storageState({ path: AUTH_STATE_PATH })
  await browser.close()
}
