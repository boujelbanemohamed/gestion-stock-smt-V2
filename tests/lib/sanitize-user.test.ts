import { describe, expect, it } from "vitest"
import { sanitizeUser } from "@/lib/sanitize-user"

describe("sanitizeUser", () => {
  it("retire le mot de passe, le secret TOTP et les codes de secours", () => {
    const user = {
      id: "u1",
      email: "jane@example.com",
      password: "hashed-password",
      twoFactorEnabled: true,
      twoFactorSecret: "SUPERSECRET",
      twoFactorBackupCodes: ["hash1", "hash2"],
    }

    const safe = sanitizeUser(user)

    expect(safe).not.toHaveProperty("password")
    expect(safe).not.toHaveProperty("twoFactorSecret")
    expect(safe).not.toHaveProperty("twoFactorBackupCodes")
    expect(safe.id).toBe("u1")
    expect(safe.email).toBe("jane@example.com")
    expect(safe.twoFactorEnabled).toBe(true)
  })
})
