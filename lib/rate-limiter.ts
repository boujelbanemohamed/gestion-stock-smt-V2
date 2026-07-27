/**
 * Système de rate limiting pour protéger les endpoints API
 * Limite le nombre de requêtes par IP ou par utilisateur
 */

import { NextRequest, NextResponse } from "next/server"

// Store simple en mémoire (à remplacer par Redis en production)
const requestStore = new Map<string, { count: number; resetTime: number }>()

// Nettoyer les entrées expirées toutes les minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of requestStore.entries()) {
    if (value.resetTime < now) {
      requestStore.delete(key)
    }
  }
}, 60 * 1000)

interface RateLimitOptions {
  windowMs: number // Fenêtre de temps en millisecondes
  maxRequests: number // Nombre maximum de requêtes
  message?: string // Message d'erreur personnalisé
  keyGenerator?: (request: NextRequest) => string // Fonction pour générer la clé unique
}

/**
 * Crée un middleware de rate limiting
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = "Trop de requêtes. Veuillez réessayer plus tard.",
    keyGenerator = (req) => {
      // Par défaut, utiliser l'IP
      const forwarded = req.headers.get("x-forwarded-for")
      const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "unknown"
      return ip
    },
  } = options

  return (request: NextRequest): NextResponse | null => {
    const key = keyGenerator(request)
    const now = Date.now()

    // Obtenir ou créer l'entrée pour cette clé
    let entry = requestStore.get(key)

    if (!entry || entry.resetTime < now) {
      // Créer une nouvelle fenêtre
      entry = {
        count: 1,
        resetTime: now + windowMs,
      }
      requestStore.set(key, entry)
      return null // Autoriser la requête
    }

    // Incrémenter le compteur
    entry.count++

    if (entry.count > maxRequests) {
      // Limite dépassée
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      return NextResponse.json(
        {
          success: false,
          error: message,
          retryAfter,
        },
        {
          status: 429, // Too Many Requests
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
          },
        }
      )
    }

    // Mettre à jour le store
    requestStore.set(key, entry)

    // Autoriser la requête
    const remaining = Math.max(0, maxRequests - entry.count)
    return null
  }
}

// Rate limiters prédéfinis

/**
 * Rate limiter pour les tentatives de connexion (5 tentatives par 15 minutes)
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: "Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.",
  keyGenerator: (req) => {
    // Utiliser l'IP pour les tentatives de connexion
    const forwarded = req.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "unknown"
    return `login:${ip}`
  },
})

/**
 * Rate limiter pour la vérification des codes 2FA (5 tentatives par 15 minutes) :
 * un code TOTP à 6 chiffres est bruteforçable en un nombre gérable d'essais
 * sans cette limite (seulement 10^6 possibilités par fenêtre de temps).
 */
export const twoFactorRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: "Trop de tentatives. Veuillez réessayer dans 15 minutes.",
  keyGenerator: (req) => {
    const forwarded = req.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "unknown"
    return `2fa:${ip}`
  },
})

/**
 * Rate limiter pour les demandes de réinitialisation de mot de passe
 * (5 demandes par 15 minutes) : évite qu'un tiers ne spamme d'emails de
 * réinitialisation vers une adresse qui n'est pas la sienne.
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: "Trop de demandes de réinitialisation. Veuillez réessayer dans 15 minutes.",
  keyGenerator: (req) => {
    const forwarded = req.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "unknown"
    return `password-reset:${ip}`
  },
})

/**
 * Rate limiter général pour les API (100 requêtes par minute)
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: "Trop de requêtes. Veuillez ralentir.",
})

/**
 * Rate limiter strict pour les actions sensibles (10 requêtes par minute)
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: "Trop de requêtes. Veuillez réessayer dans une minute.",
})

