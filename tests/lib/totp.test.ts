import { describe, expect, it } from "vitest"
import { generateBase32Secret, generateTotp, verifyTotp, buildOtpAuthUri } from "@/lib/totp"

// Encode une chaîne ASCII brute en base32, pour rejouer les vecteurs de test
// officiels de la RFC 6238 (dont le secret y est donné en clair, pas en base32).
function base32EncodeAscii(ascii: string): string {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const buffer = Buffer.from(ascii, "ascii")
  let bits = 0
  let value = 0
  let output = ""
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31]
  return output
}

// Vecteurs de test officiels RFC 6238, Annexe B (secret SHA1, codes à 8 chiffres).
const RFC6238_SECRET_SHA1 = base32EncodeAscii("12345678901234567890")
const RFC6238_VECTORS: Array<[number, string]> = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
]

describe("generateTotp - vecteurs de test RFC 6238", () => {
  it.each(RFC6238_VECTORS)("produit le bon code à t=%i", (unixSeconds, expected) => {
    const code = generateTotp(
      RFC6238_SECRET_SHA1,
      { digits: 8, period: 30, algorithm: "SHA1" },
      unixSeconds * 1000,
    )
    expect(code).toBe(expected)
  })
})

describe("generateBase32Secret", () => {
  it("génère un secret non vide composé uniquement de caractères base32", () => {
    const secret = generateBase32Secret()
    expect(secret.length).toBeGreaterThan(0)
    expect(secret).toMatch(/^[A-Z2-7]+$/)
  })

  it("génère un secret différent à chaque appel", () => {
    expect(generateBase32Secret()).not.toBe(generateBase32Secret())
  })
})

describe("verifyTotp", () => {
  const secret = generateBase32Secret()

  it("accepte le code courant", () => {
    const code = generateTotp(secret)
    expect(verifyTotp(secret, code)).toBe(true)
  })

  it("rejette un code incorrect", () => {
    expect(verifyTotp(secret, "000000")).toBe(false)
  })

  it("tolère un léger décalage d'horloge (une période avant/après)", () => {
    const period = 30
    const now = Date.now()
    const codeOnePeriodAgo = generateTotp(secret, { period }, now - period * 1000)
    expect(verifyTotp(secret, codeOnePeriodAgo, { period }, 1)).toBe(true)
  })

  it("rejette un code trop ancien (hors de la fenêtre de tolérance)", () => {
    const period = 30
    const now = Date.now()
    const oldCode = generateTotp(secret, { period }, now - period * 1000 * 5)
    expect(verifyTotp(secret, oldCode, { period }, 1)).toBe(false)
  })

  it("ignore les espaces dans le code saisi", () => {
    const code = generateTotp(secret)
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
    expect(verifyTotp(secret, spaced)).toBe(true)
  })
})

describe("buildOtpAuthUri", () => {
  it("construit une URI otpauth:// exploitable par un lecteur de QR code", () => {
    const uri = buildOtpAuthUri({
      secret: "JBSWY3DPEHPK3PXP",
      accountName: "jane@example.com",
      issuer: "Gestion de Stocks",
    })

    expect(uri).toMatch(/^otpauth:\/\/totp\//)
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP")
    expect(uri).toContain("issuer=Gestion")
    expect(decodeURIComponent(uri)).toContain("Gestion de Stocks:jane@example.com")
  })
})
