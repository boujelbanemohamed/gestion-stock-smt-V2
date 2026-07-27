// Implémentation TOTP (RFC 6238) / HOTP (RFC 4226) sans dépendance externe,
// basée uniquement sur le module "crypto" de Node. Compatible Google
// Authenticator, Microsoft Authenticator, 1Password, etc.

import { createHmac, randomBytes } from "crypto"

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

export type TotpAlgorithm = "SHA1" | "SHA256" | "SHA512"

export interface TotpOptions {
  digits?: number
  period?: number
  algorithm?: TotpAlgorithm
}

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ""
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "")
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** Génère un secret TOTP aléatoire encodé en base32. */
export function generateBase32Secret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength))
}

function hotp(secret: string, counter: number, digits: number, algorithm: TotpAlgorithm): string {
  const key = base32Decode(secret)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const hmac = createHmac(algorithm.toLowerCase(), key).update(counterBuffer).digest()
  // Troncature dynamique (RFC 4226 §5.3), valable quel que soit l'algorithme de hachage.
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return (binary % 10 ** digits).toString().padStart(digits, "0")
}

/** Calcule le code TOTP courant pour un secret donné, à un instant précis (par défaut : maintenant). */
export function generateTotp(secret: string, options: TotpOptions = {}, timestamp = Date.now()): string {
  const { digits = 6, period = 30, algorithm = "SHA1" } = options
  const counter = Math.floor(timestamp / 1000 / period)
  return hotp(secret, counter, digits, algorithm)
}

/**
 * Vérifie un code TOTP saisi par l'utilisateur, en tolérant un léger décalage
 * d'horloge (une période avant/après par défaut).
 */
export function verifyTotp(secret: string, token: string, options: TotpOptions = {}, window = 1): boolean {
  const { period = 30 } = options
  const cleanToken = token.replace(/\s+/g, "")
  if (!cleanToken) return false

  const now = Date.now()
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const candidate = generateTotp(secret, options, now + errorWindow * period * 1000)
    if (candidate === cleanToken) return true
  }
  return false
}

/** Construit l'URI otpauth:// à encoder en QR code pour la configuration dans une app d'authentification. */
export function buildOtpAuthUri(params: {
  secret: string
  accountName: string
  issuer: string
  digits?: number
  period?: number
  algorithm?: TotpAlgorithm
}): string {
  const { secret, accountName, issuer, digits = 6, period = 30, algorithm = "SHA1" } = params
  const label = encodeURIComponent(`${issuer}:${accountName}`)
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm,
    digits: String(digits),
    period: String(period),
  })
  return `otpauth://totp/${label}?${query.toString()}`
}
