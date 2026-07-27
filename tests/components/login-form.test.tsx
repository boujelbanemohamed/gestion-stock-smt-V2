import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import LoginForm from "@/components/auth/login-form"
import * as apiClient from "@/lib/api-client"

vi.mock("next/image", () => ({
  // next/image exige un environnement Next complet ; un <img> simple suffit pour ces tests.
  default: (props: any) => <img {...props} />,
}))

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "saveAuthTokens").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("affiche les champs email et mot de passe, tous deux obligatoires", () => {
    render(<LoginForm onLogin={vi.fn()} />)

    expect(screen.getByLabelText("Email")).toBeRequired()
    expect(screen.getByLabelText("Mot de passe")).toBeRequired()
  })

  it("appelle onLogin avec l'utilisateur et sauvegarde les tokens après une connexion réussie", async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    const mockUser = { id: "u1", email: "jane@example.com", firstName: "Jane", lastName: "Doe", role: "admin" }
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        success: true,
        data: { user: mockUser, accessToken: "access-token", refreshToken: "refresh-token" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    render(<LoginForm onLogin={onLogin} />)

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Mot de passe"), "secret123")
    await user.click(screen.getByRole("button", { name: /se connecter/i }))

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(mockUser))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "jane@example.com", password: "secret123" }),
      }),
    )
    expect(apiClient.saveAuthTokens).toHaveBeenCalledWith("access-token", "refresh-token", mockUser)
  })

  it("affiche le message d'erreur du serveur et n'appelle pas onLogin en cas d'échec", async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(jsonResponse({ success: false, error: "Email ou mot de passe incorrect" })),
    )

    render(<LoginForm onLogin={onLogin} />)

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Mot de passe"), "mauvais-mdp")
    await user.click(screen.getByRole("button", { name: /se connecter/i }))

    expect(await screen.findByText("Email ou mot de passe incorrect")).toBeInTheDocument()
    expect(onLogin).not.toHaveBeenCalled()
  })

  it("affiche un message générique si l'appel réseau échoue", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

    render(<LoginForm onLogin={vi.fn()} />)

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Mot de passe"), "secret123")
    await user.click(screen.getByRole("button", { name: /se connecter/i }))

    expect(await screen.findByText("Erreur de connexion au serveur")).toBeInTheDocument()
  })

  it("passe à la saisie du code 2FA quand le compte l'exige, puis termine la connexion", async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    const mockUser = { id: "u1", email: "jane@example.com", firstName: "Jane", lastName: "Doe", role: "admin" }

    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/login") {
        return jsonResponse({ success: true, data: { requiresTwoFactor: true, tempToken: "temp-token-abc" } })
      }
      if (url === "/api/auth/2fa/verify-login") {
        return jsonResponse({
          success: true,
          data: { user: mockUser, accessToken: "access-token", refreshToken: "refresh-token" },
        })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<LoginForm onLogin={onLogin} />)

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Mot de passe"), "secret123")
    await user.click(screen.getByRole("button", { name: /se connecter/i }))

    expect(await screen.findByLabelText("Code de vérification")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Code de vérification"), "654321")
    await user.click(screen.getByRole("button", { name: /vérifier/i }))

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(mockUser))
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/2fa/verify-login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tempToken: "temp-token-abc", code: "654321" }),
      }),
    )
    expect(apiClient.saveAuthTokens).toHaveBeenCalledWith("access-token", "refresh-token", mockUser)
  })

  it("force la configuration de la 2FA si l'admin l'a exigée sans que l'utilisateur l'ait déjà configurée", async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    const mockUser = { id: "u1", email: "jane@example.com", firstName: "Jane", lastName: "Doe", role: "user" }

    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/login") {
        return jsonResponse({ success: true, data: { requiresTwoFactorSetup: true, tempToken: "temp-token-abc" } })
      }
      if (url === "/api/auth/2fa/setup-login") {
        return jsonResponse({
          success: true,
          data: { secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/x", qrCodeDataUrl: "data:image/png;base64,fake" },
        })
      }
      if (url === "/api/auth/2fa/enable-login") {
        return jsonResponse({
          success: true,
          data: {
            user: mockUser,
            accessToken: "access-token",
            refreshToken: "refresh-token",
            backupCodes: ["AAAAA-BBBBB", "CCCCC-DDDDD"],
          },
        })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<LoginForm onLogin={onLogin} />)

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Mot de passe"), "secret123")
    await user.click(screen.getByRole("button", { name: /se connecter/i }))

    expect(await screen.findByAltText("QR code de double authentification")).toBeInTheDocument()
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Code de vérification"), "123456")
    await user.click(screen.getByRole("button", { name: /activer et se connecter/i }))

    expect(await screen.findByText("AAAAA-BBBBB")).toBeInTheDocument()
    expect(onLogin).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /j'ai noté mes codes, continuer/i }))

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(mockUser))
    expect(apiClient.saveAuthTokens).toHaveBeenCalledWith("access-token", "refresh-token", mockUser)
  })

  it("affiche un message dédié et masque le lien mot de passe oublié quand le compte est désactivé", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        jsonResponse({ success: false, error: "Ce compte est désactivé", data: { accountDisabled: true } }),
      ),
    )

    render(<LoginForm onLogin={vi.fn()} />)

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Mot de passe"), "secret123")
    await user.click(screen.getByRole("button", { name: /se connecter/i }))

    expect(await screen.findByText("Votre compte est désactivé. Contactez l'administrateur.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /mot de passe oublié/i })).not.toBeInTheDocument()
  })

  it("verrouille le formulaire et affiche le compte à rebours après un verrouillage serveur", async () => {
    const user = userEvent.setup()
    const lockedUntil = new Date(Date.now() + 125 * 1000).toISOString() // 2:05
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        jsonResponse({
          success: false,
          error: "Trop de tentatives échouées. Votre compte est temporairement verrouillé.",
          data: { locked: true, lockedUntil },
        }),
      ),
    )

    render(<LoginForm onLogin={vi.fn()} />)

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Mot de passe"), "wrong")
    await user.click(screen.getByRole("button", { name: /se connecter/i }))

    expect(await screen.findByText(/réessayez dans/i)).toBeInTheDocument()
    expect(screen.getByText("2:05")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /se connecter/i })).toBeDisabled()
    // Le lien mot de passe oublié reste disponible pour débloquer immédiatement le compte.
    expect(screen.getByRole("button", { name: /mot de passe oublié/i })).toBeInTheDocument()
  })

  it("permet de demander une réinitialisation de mot de passe depuis l'écran de connexion", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/forgot-password") {
        return jsonResponse({ success: true, message: "Si un compte existe..." })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<LoginForm onLogin={vi.fn()} />)

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.click(screen.getByRole("button", { name: /mot de passe oublié/i }))

    const resetEmailInput = await screen.findByLabelText("Email")
    expect(resetEmailInput).toHaveValue("jane@example.com")

    await user.click(screen.getByRole("button", { name: /envoyer le lien de réinitialisation/i }))

    expect(await screen.findByText(/un email contenant un lien de/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "jane@example.com" }) }),
    )

    await user.click(screen.getByRole("button", { name: /retour à la connexion/i }))
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument()
  })

  it("le bouton Retour ramène à la saisie email/mot de passe", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        jsonResponse({ success: true, data: { requiresTwoFactor: true, tempToken: "temp-token-abc" } }),
      ),
    )

    render(<LoginForm onLogin={vi.fn()} />)

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Mot de passe"), "secret123")
    await user.click(screen.getByRole("button", { name: /se connecter/i }))

    expect(await screen.findByLabelText("Code de vérification")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /retour/i }))

    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument()
  })
})
