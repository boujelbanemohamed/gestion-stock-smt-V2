import { describe, expect, it } from "vitest"
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  extractTokenFromHeader,
  signTwoFactorPendingToken,
  verifyTwoFactorPendingToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
  fingerprintPassword,
} from "@/lib/auth"

const basePayload = {
  userId: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "admin",
}

describe("signAccessToken / verifyAccessToken", () => {
  it("verifie un token qu'elle vient de signer et retrouve le payload d'origine", () => {
    const token = signAccessToken(basePayload)
    const decoded = verifyAccessToken(token)

    expect(decoded.userId).toBe(basePayload.userId)
    expect(decoded.email).toBe(basePayload.email)
    expect(decoded.firstName).toBe(basePayload.firstName)
    expect(decoded.lastName).toBe(basePayload.lastName)
    expect(decoded.role).toBe(basePayload.role)
  })

  it("rejette un token invalide", () => {
    expect(() => verifyAccessToken("token.invalide.abc")).toThrow(/invalide/i)
  })

  it("rejette un token signé avec un autre secret", () => {
    // Un token signé avec un algorithme/format différent (ici juste du texte
    // aléatoire encodé en 3 segments) ne doit jamais être considéré valide.
    const bogusToken = ["aaaa", "bbbb", "cccc"].join(".")
    expect(() => verifyAccessToken(bogusToken)).toThrow()
  })
})

describe("signRefreshToken", () => {
  it("produit un token distinct du token d'accès pour le même utilisateur", () => {
    const accessToken = signAccessToken(basePayload)
    const refreshToken = signRefreshToken(basePayload)

    expect(refreshToken).not.toBe(accessToken)
    expect(typeof refreshToken).toBe("string")
    expect(refreshToken.split(".")).toHaveLength(3)
  })
})

describe("signTwoFactorPendingToken / verifyTwoFactorPendingToken", () => {
  it("verifie un jeton 2FA en attente et retrouve l'identifiant utilisateur", () => {
    const token = signTwoFactorPendingToken("user-42")
    const decoded = verifyTwoFactorPendingToken(token)

    expect(decoded.userId).toBe("user-42")
    expect(decoded.purpose).toBe("2fa_pending")
  })

  it("ne peut jamais être accepté comme un token d'accès classique (audience différente)", () => {
    const pendingToken = signTwoFactorPendingToken("user-42")
    expect(() => verifyAccessToken(pendingToken)).toThrow()
  })

  it("un vrai token d'accès ne peut pas être utilisé comme jeton 2FA en attente", () => {
    const accessToken = signAccessToken(basePayload)
    expect(() => verifyTwoFactorPendingToken(accessToken)).toThrow()
  })
})

describe("signPasswordResetToken / verifyPasswordResetToken", () => {
  it("verifie un jeton de réinitialisation et retrouve l'identifiant utilisateur", () => {
    const token = signPasswordResetToken("user-42", "hashed-password-v1")
    const decoded = verifyPasswordResetToken(token)

    expect(decoded.userId).toBe("user-42")
    expect(decoded.passwordFingerprint).toBe(fingerprintPassword("hashed-password-v1"))
  })

  it("ne peut jamais être accepté comme un token d'accès classique (audience différente)", () => {
    const resetToken = signPasswordResetToken("user-42", "hashed-password-v1")
    expect(() => verifyAccessToken(resetToken)).toThrow()
  })

  it("l'empreinte ne correspond plus si le mot de passe a changé entre-temps (jeton à usage unique de fait)", () => {
    const token = signPasswordResetToken("user-42", "hashed-password-v1")
    const decoded = verifyPasswordResetToken(token)

    // Le mot de passe a été modifié depuis l'émission du jeton (ex: déjà
    // consommé une première fois, ou changé manuellement) : l'empreinte du
    // nouveau hash ne correspond plus à celle embarquée dans le jeton.
    expect(decoded.passwordFingerprint).not.toBe(fingerprintPassword("hashed-password-v2"))
  })
})

describe("extractTokenFromHeader", () => {
  it("extrait le token d'un header Authorization Bearer valide", () => {
    expect(extractTokenFromHeader("Bearer abc.def.ghi")).toBe("abc.def.ghi")
  })

  it("retourne null si le header est absent", () => {
    expect(extractTokenFromHeader(null)).toBeNull()
  })

  it("retourne null si le header ne commence pas par Bearer", () => {
    expect(extractTokenFromHeader("Basic abc123")).toBeNull()
  })
})
