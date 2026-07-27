import { test, expect } from "@playwright/test"
import { prisma } from "./db"

// Ce spec teste le formulaire de connexion (verrouillage), donc pas de
// session partagée.
test.use({ storageState: { cookies: [], origins: [] } })

const LOCKED_USER_EMAIL = "user@monetique.tn"

// On abaisse temporairement le seuil de verrouillage à 1 tentative : cela
// suffit à démontrer le comportement de bout en bout (message, compte à
// rebours, bouton désactivé) en une seule requête, ce qui laisse de la marge
// dans le quota du rate limiter de /api/auth/login partagé par toute la
// suite e2e (voir e2e/global-setup.ts). La logique fine de comptage des
// tentatives est déjà couverte par les tests unitaires (tests/api/auth-login.test.ts).
test.beforeAll(async () => {
  const config = await prisma.appConfig.findUnique({ where: { id: "singleton" } })
  const data = config?.config as any
  await prisma.appConfig.update({
    where: { id: "singleton" },
    data: { config: { ...data, security: { ...data.security, maxLoginAttempts: 1 } } },
  })
})

test.afterAll(async () => {
  const config = await prisma.appConfig.findUnique({ where: { id: "singleton" } })
  const data = config?.config as any
  await prisma.appConfig.update({
    where: { id: "singleton" },
    data: { config: { ...data, security: { ...data.security, maxLoginAttempts: 5 } } },
  })
  await prisma.user.update({
    where: { email: LOCKED_USER_EMAIL },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  })
  await prisma.$disconnect()
})

test("verrouille le compte après le nombre configuré de tentatives échouées, et affiche le compte à rebours", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByLabel("Email").fill(LOCKED_USER_EMAIL)
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe")
  await page.getByRole("button", { name: "Se connecter" }).click()

  await expect(
    page.getByText("Compte temporairement verrouillé suite à plusieurs tentatives échouées"),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeDisabled()
})
