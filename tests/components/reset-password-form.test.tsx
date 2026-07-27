import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ResetPasswordForm from "@/components/auth/reset-password-form"

const mockSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}))

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    mockSearchParams.delete("token")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("affiche une erreur si aucun jeton n'est présent dans l'URL", () => {
    render(<ResetPasswordForm />)
    expect(screen.getByText(/lien de réinitialisation est invalide/i)).toBeInTheDocument()
  })

  it("refuse un mot de passe trop court sans appeler l'API", async () => {
    mockSearchParams.set("token", "valid-token")
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    render(<ResetPasswordForm />)

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "123")
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), "123")
    await user.click(screen.getByRole("button", { name: /réinitialiser le mot de passe/i }))

    expect(await screen.findByText("Le mot de passe doit contenir au moins 6 caractères")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuse si les deux mots de passe ne correspondent pas", async () => {
    mockSearchParams.set("token", "valid-token")
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn())

    render(<ResetPasswordForm />)

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "nouveau-mdp")
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), "autre-mdp")
    await user.click(screen.getByRole("button", { name: /réinitialiser le mot de passe/i }))

    expect(await screen.findByText("Les mots de passe ne correspondent pas")).toBeInTheDocument()
  })

  it("réinitialise le mot de passe avec un jeton valide et affiche la confirmation", async () => {
    mockSearchParams.set("token", "valid-token")
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockReturnValue(jsonResponse({ success: true, message: "Mot de passe réinitialisé" }))
    vi.stubGlobal("fetch", fetchMock)

    render(<ResetPasswordForm />)

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "nouveau-mot-de-passe")
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), "nouveau-mot-de-passe")
    await user.click(screen.getByRole("button", { name: /réinitialiser le mot de passe/i }))

    expect(await screen.findByText(/bien été réinitialisé/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "valid-token", newPassword: "nouveau-mot-de-passe" }),
      }),
    )
  })

  it("affiche l'erreur renvoyée par le serveur (ex: jeton expiré)", async () => {
    mockSearchParams.set("token", "expired-token")
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        jsonResponse({ success: false, error: "Ce lien de réinitialisation a expiré, veuillez en redemander un nouveau" }),
      ),
    )

    render(<ResetPasswordForm />)

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "nouveau-mot-de-passe")
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), "nouveau-mot-de-passe")
    await user.click(screen.getByRole("button", { name: /réinitialiser le mot de passe/i }))

    expect(await screen.findByText(/a expiré/i)).toBeInTheDocument()
  })
})
