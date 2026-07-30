/**
 * Gestion de l'authentification avec JWT
 * Fournit des fonctions pour signer, vérifier et décoder les tokens JWT
 */

import jwt from "jsonwebtoken"
import { createHash } from "crypto"
import { env } from "./env"

// Secret pour signer les JWT (utilise les valeurs validées depuis lib/env.ts)
// En production, ces secrets DOIVENT être définis dans les variables d'environnement
const JWT_SECRET = env.JWT_SECRET || process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-secret-change-in-production-min-32-chars")
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-refresh-secret-change-in-production-min-32-chars")

// Vérifier que les secrets sont définis en production (seulement au runtime, pas au build)
// On ne peut pas vérifier au build car les variables d'environnement peuvent ne pas être chargées
// La vérification se fera au runtime dans les fonctions signAccessToken et signRefreshToken

// Durée de vie des tokens (en secondes)
const ACCESS_TOKEN_EXPIRES_IN = 15 * 60 // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 // 7 jours

export interface JWTPayload {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: string
  iat?: number
  exp?: number
}

/**
 * Génère un token JWT d'accès
 */
export function signAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  // Vérifier au runtime (pas au build)
  if (process.env.NODE_ENV === "production") {
    if (!JWT_SECRET || JWT_SECRET.length < 32) {
      const errorMsg = "JWT_SECRET invalide ou manquant lors de la signature"
      console.error(`[JWT] ERREUR: ${errorMsg}`)
      throw new Error(errorMsg)
    }
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    issuer: "gestion-stock-smt",
    audience: "gestion-stock-smt-users",
  })
}

/**
 * Génère un token JWT de rafraîchissement
 */
export function signRefreshToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  // Vérifier au runtime (pas au build)
  if (process.env.NODE_ENV === "production") {
    if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 32) {
      const errorMsg = `JWT_REFRESH_SECRET invalide ou manquant lors de la signature (longueur: ${JWT_REFRESH_SECRET ? JWT_REFRESH_SECRET.length : 0})`
      console.error(`[JWT] ERREUR: ${errorMsg}`)
      throw new Error(errorMsg)
    }
  }
  
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
    },
    JWT_REFRESH_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      issuer: "gestion-stock-smt",
      audience: "gestion-stock-smt-users",
    }
  )
}

/**
 * Vérifie et décode un token JWT d'accès
 * @throws {Error} Si le token est invalide ou expiré
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    // Vérifier au runtime (pas au build)
    if (process.env.NODE_ENV === "production") {
      if (!JWT_SECRET || JWT_SECRET.length < 32) {
        const errorMsg = "JWT_SECRET invalide ou manquant"
        console.error(`[JWT] ERREUR: ${errorMsg}`)
        throw new Error(errorMsg)
      }
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: "gestion-stock-smt",
      audience: "gestion-stock-smt-users",
    }) as JWTPayload

    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error(`[JWT] ERREUR: Token expiré`)
      throw new Error("Token expiré")
    }
    if (error instanceof jwt.JsonWebTokenError) {
      console.error(`[JWT] ERREUR: Token invalide - ${error.message}`)
      throw new Error(`Token invalide: ${error.message}`)
    }
    console.error(`[JWT] ERREUR: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

/**
 * Vérifie et décode un token JWT de rafraîchissement
 * @throws {Error} Si le token est invalide ou expiré
 */
export function verifyRefreshToken(token: string): { userId: string; email: string } {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: "gestion-stock-smt",
      audience: "gestion-stock-smt-users",
    }) as { userId: string; email: string }

    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token de rafraîchissement expiré")
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Token de rafraîchissement invalide")
    }
    throw error
  }
}

// Jeton intermédiaire émis après un mot de passe valide lorsque la double
// authentification est activée, en attendant la vérification du code TOTP.
// Une audience distincte de celle des tokens d'accès garantit qu'il ne peut
// jamais être accepté par erreur par requireAuth/verifyAccessToken sur une
// route protégée : jwt.verify rejette immédiatement une audience différente.
const TWO_FACTOR_PENDING_EXPIRES_IN = 5 * 60 // 5 minutes
const TWO_FACTOR_PENDING_AUDIENCE = "gestion-stock-smt-2fa-pending"

export interface TwoFactorPendingPayload {
  userId: string
  purpose: "2fa_pending"
}

/**
 * Signe un jeton temporaire identifiant l'utilisateur dont le mot de passe
 * vient d'être validé, en attente de la vérification de son code 2FA.
 */
export function signTwoFactorPendingToken(userId: string): string {
  const payload: TwoFactorPendingPayload = { userId, purpose: "2fa_pending" }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TWO_FACTOR_PENDING_EXPIRES_IN,
    issuer: "gestion-stock-smt",
    audience: TWO_FACTOR_PENDING_AUDIENCE,
  })
}

/**
 * Vérifie un jeton temporaire de double authentification
 * @throws {Error} Si le jeton est invalide, expiré, ou n'est pas un jeton 2FA
 */
export function verifyTwoFactorPendingToken(token: string): TwoFactorPendingPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: "gestion-stock-smt",
      audience: TWO_FACTOR_PENDING_AUDIENCE,
    }) as TwoFactorPendingPayload

    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Session de connexion expirée, veuillez vous reconnecter")
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Jeton de connexion invalide")
    }
    throw error
  }
}

// Jeton de réinitialisation de mot de passe ("mot de passe oublié"), envoyé
// par email. Aucune table dédiée n'est nécessaire : le jeton embarque une
// empreinte du hash du mot de passe actuel, donc dès que le mot de passe
// change (via ce flux ou un autre), l'empreinte ne correspond plus et le
// jeton est automatiquement invalidé — y compris pour un usage unique.
const PASSWORD_RESET_EXPIRES_IN = 30 * 60 // 30 minutes
const PASSWORD_RESET_AUDIENCE = "gestion-stock-smt-password-reset"

export interface PasswordResetPayload {
  userId: string
  passwordFingerprint: string
}

export function fingerprintPassword(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16)
}

/**
 * Signe un jeton de réinitialisation de mot de passe pour un utilisateur.
 */
export function signPasswordResetToken(userId: string, currentPasswordHash: string): string {
  const payload: PasswordResetPayload = {
    userId,
    passwordFingerprint: fingerprintPassword(currentPasswordHash),
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: PASSWORD_RESET_EXPIRES_IN,
    issuer: "gestion-stock-smt",
    audience: PASSWORD_RESET_AUDIENCE,
  })
}

/**
 * Vérifie un jeton de réinitialisation de mot de passe.
 * @throws {Error} Si le jeton est invalide, expiré, ou n'est pas un jeton de réinitialisation
 */
export function verifyPasswordResetToken(token: string): PasswordResetPayload {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: "gestion-stock-smt",
      audience: PASSWORD_RESET_AUDIENCE,
    }) as PasswordResetPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Ce lien de réinitialisation a expiré, veuillez en redemander un nouveau")
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Lien de réinitialisation invalide")
    }
    throw error
  }
}

// Ticket de très courte durée servant uniquement à ouvrir la connexion SSE de
// /api/events. L'API navigateur EventSource ne permet pas d'en-tête
// Authorization : un jeton doit donc voyager dans l'URL. Y mettre le vrai
// jeton d'accès (15 minutes) l'exposerait, pour toute sa durée de vie, à
// quiconque lit un journal d'accès ou un outil de supervision qui capture les
// URL complètes. Ce ticket, lui, expire en 60 secondes et ne sert à rien
// d'autre : même journalisé, il est déjà inutilisable.
const REALTIME_TICKET_EXPIRES_IN = 60 // secondes
const REALTIME_TICKET_AUDIENCE = "gestion-stock-smt-realtime"

export interface RealtimeTicketPayload {
  userId: string
}

/**
 * Signe un ticket de courte durée pour ouvrir la connexion SSE d'un utilisateur.
 */
export function signRealtimeTicket(userId: string): string {
  const payload: RealtimeTicketPayload = { userId }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REALTIME_TICKET_EXPIRES_IN,
    issuer: "gestion-stock-smt",
    audience: REALTIME_TICKET_AUDIENCE,
  })
}

/**
 * Vérifie un ticket de connexion temps réel.
 * @throws {Error} Si le ticket est invalide, expiré, ou n'est pas un ticket temps réel
 */
export function verifyRealtimeTicket(token: string): RealtimeTicketPayload {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: "gestion-stock-smt",
      audience: REALTIME_TICKET_AUDIENCE,
    }) as RealtimeTicketPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Ticket de connexion temps réel expiré")
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Ticket de connexion temps réel invalide")
    }
    throw error
  }
}

/**
 * Décode un token sans vérifier sa signature (utilisé uniquement pour des raisons de debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload
  } catch {
    return null
  }
}

/**
 * Extrait le token du header Authorization
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  return authHeader.substring(7)
}

