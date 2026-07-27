import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ProfilePage from "@/app/dashboard/profile/page"

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

const storedUser = {
  id: "u1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "admin",
  isActive: true,
  twoFactorEnabled: false,
}

describe("ProfilePage - Double authentification (2FA)", () => {
  beforeEach(() => {
    localStorage.setItem("currentUser", JSON.stringify(storedUser))
    localStorage.setItem("accessToken", "access-token")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("propose d'activer la 2FA quand elle est désactivée, puis affiche le QR code et les codes de secours", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/config") {
        return jsonResponse({ success: true, data: { security: { twoFactor: { enabled: true } } } })
      }
      if (url === "/api/auth/2fa/setup") {
        return jsonResponse({
          success: true,
          data: { secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/x", qrCodeDataUrl: "data:image/png;base64,fake" },
        })
      }
      if (url === "/api/auth/2fa/enable") {
        return jsonResponse({ success: true, data: { backupCodes: ["AAAAA-BBBBB", "CCCCC-DDDDD"] } })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<ProfilePage />)

    expect(await screen.findByText("Non activée")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /activer la double authentification/i }))

    expect(await screen.findByAltText("QR code de double authentification")).toBeInTheDocument()
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Code de vérification"), "123456")
    await user.click(screen.getByRole("button", { name: /confirmer et activer/i }))

    expect(await screen.findByText("AAAAA-BBBBB")).toBeInTheDocument()
    expect(screen.getByText("CCCCC-DDDDD")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /j'ai noté mes codes/i }))

    await waitFor(() => expect(screen.getByText("Activée")).toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem("currentUser")!).twoFactorEnabled).toBe(true)
  })

  it("désactive la 2FA après confirmation du mot de passe", async () => {
    localStorage.setItem("currentUser", JSON.stringify({ ...storedUser, twoFactorEnabled: true }))
    const user = userEvent.setup()
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/config") {
        return jsonResponse({ success: true, data: { security: { twoFactor: { enabled: true } } } })
      }
      if (url === "/api/auth/2fa/disable") {
        return jsonResponse({ success: true, message: "Double authentification désactivée" })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<ProfilePage />)

    expect(await screen.findByText("Activée")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^désactiver$/i }))
    await user.type(screen.getByLabelText(/confirmez votre mot de passe/i), "correct-password")
    await user.click(screen.getByRole("button", { name: /confirmer la désactivation/i }))

    await waitFor(() => expect(screen.getByText("Non activée")).toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem("currentUser")!).twoFactorEnabled).toBe(false)
  })

  it("masque la section 2FA si elle est désactivée globalement et que l'utilisateur ne l'a pas activée", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(jsonResponse({ success: true, data: { security: { twoFactor: { enabled: false } } } })),
    )

    render(<ProfilePage />)

    await waitFor(() => expect(screen.getByText("Informations du compte")).toBeInTheDocument())
    expect(screen.queryByText("Double authentification (2FA)")).not.toBeInTheDocument()
  })
})
