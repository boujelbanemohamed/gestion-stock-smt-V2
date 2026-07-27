import path from "node:path"
import "dotenv/config"
import { defineConfig, devices } from "@playwright/test"
import { AUTH_STATE_PATH } from "./e2e/helpers"

const PORT = process.env.PLAYWRIGHT_PORT || "3010"
const baseURL = `http://localhost:${PORT}`

// Tests end-to-end (navigateur réel, base de données réelle). Contrairement
// à la suite Vitest (npm test) qui mocke Prisma et fetch, ces tests exercent
// l'application complète : ils nécessitent une base de données PostgreSQL de
// test accessible via DATABASE_URL (jamais la base de production) et un
// utilisateur admin seedé (voir e2e/README.md).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // les specs partagent la même base de données de test
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  // Authentifie une seule fois pour toute la suite (voir e2e/global-setup.ts)
  // afin de ne pas dépasser le quota du rate limiter de /api/auth/login.
  globalSetup: path.join(__dirname, "e2e", "global-setup.ts"),
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Session admin partagée par défaut ; les specs qui testent le formulaire
    // de connexion lui-même (e2e/login.spec.ts) la désactivent explicitement.
    storageState: AUTH_STATE_PATH,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Par défaut, utilise le Google Chrome déjà installé sur la machine
        // (aucun téléchargement requis, donc rien à récupérer sur
        // cdn.playwright.dev). PLAYWRIGHT_CHROMIUM_PATH permet de pointer
        // vers un binaire Chromium précis à la place (utilisé par exemple
        // dans les environnements CI/sandbox sans accès réseau sortant).
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : { channel: "chrome" }),
      },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
})
