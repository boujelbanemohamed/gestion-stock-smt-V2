import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ConfigurationPanel from "@/components/dashboard/configuration-panel"

// jsdom n'implémente pas ces APIs de pointeur utilisées par Radix Select ;
// sans ce polyfill, ouvrir le menu déroulant lève une TypeError.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const fullConfig = {
  general: { companyName: "Monetique Tunisie", logo: "", language: "fr", currency: "TND", timezone: "Africa/Tunis" },
  smtp: { host: "smtp.gmail.com", port: 587, secure: false, username: "", password: "", fromEmail: "", fromName: "" },
  notifications: {
    enabled: true,
    lowStockAlerts: { inApp: true, email: true },
    movementNotifications: { inApp: true, email: true },
    userActivityAlerts: { inApp: true, email: true },
    accountEmails: {
      welcomeEmail: true,
      passwordResetEmail: true,
      passwordChangedEmail: true,
      authMethodChangedEmail: true,
    },
    lowStockThreshold: 100,
    criticalStockThreshold: 50,
    emailNotifications: true,
    inAppNotifications: true,
    emailRecipients: [],
  },
  display: { dateFormat: "DD/MM/YYYY", timeFormat: "24h", numberFormat: "fr-TN", itemsPerPage: 10, theme: "auto" },
  security: {
    idleWarningMinutes: 15,
    idleLogoutMinutes: 5,
    requireStrongPassword: true,
    minPasswordLength: 8,
    twoFactor: {
      enabled: false,
      appName: "Monetique Tunisie",
      issuer: "Monetique",
      codeLength: 6,
      codePeriod: 30,
      algorithm: "SHA1",
      mandatory: false,
      mandatoryRoles: [],
      gracePeriodDays: 7,
    },
    maxLoginAttempts: 5,
    lockoutDuration: 30,
  },
}

describe("ConfigurationPanel - aperçu des templates email", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/config") return jsonResponse({ success: true, data: fullConfig })
        if (url === "/api/movement-reasons") return jsonResponse({ success: true, data: [] })
        throw new Error(`Unexpected fetch to ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("propose les 7 templates dans un menu déroulant (pas de grille d'onglets qui déborde)", async () => {
    const user = userEvent.setup()
    render(<ConfigurationPanel />)

    await user.click(await screen.findByRole("tab", { name: /notifications/i }))
    await user.click(await screen.findByRole("button", { name: /voir l'aperçu des templates email/i }))
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()

    const select = screen.getByRole("combobox")
    await user.click(select)

    for (const label of [
      "Bienvenue",
      "Mot de passe oublié",
      "Mot de passe modifié",
      "Méthode d'authentification modifiée",
      "Alerte stock bas",
      "Notification de mouvement",
      "Activité utilisateur",
    ]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument()
    }
  })

  it("affiche l'aperçu correspondant au template sélectionné", async () => {
    const user = userEvent.setup()
    render(<ConfigurationPanel />)

    await user.click(await screen.findByRole("tab", { name: /notifications/i }))
    await user.click(await screen.findByRole("button", { name: /voir l'aperçu des templates email/i }))

    const select = screen.getByRole("combobox")
    await user.click(select)
    await user.click(await screen.findByRole("option", { name: "Mot de passe modifié" }))

    const iframe = document.querySelector("iframe") as HTMLIFrameElement
    expect(iframe).not.toBeNull()
    expect(iframe.srcdoc).toContain("Mot de passe modifié")
  })
})
