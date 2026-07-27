/**
 * Helper pour vérifier l'authentification dans les routes API
 * À utiliser dans les routes API qui nécessitent une authentification
 * (Le middleware Next.js ne peut pas utiliser jsonwebtoken car il s'exécute dans Edge Runtime)
 */

import { type NextRequest, NextResponse } from "next/server"
import { verifyAccessToken, extractTokenFromHeader } from "@/lib/auth"
import { logger } from "@/lib/logger"
import type { ApiResponse } from "@/lib/api-types"

export interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
  }
}

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

// Rôles considérés comme administrateurs pour les actions sensibles
// (gestion des utilisateurs, des rôles, de la configuration de l'application).
const ADMIN_ROLES = ["admin", "super_admin"]

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role.toLowerCase())
}

type AuthResult =
  | { authorized: true; user: AuthUser }
  | { authorized: false; response: NextResponse }

/**
 * Vérifie qu'une requête API porte un JWT valide.
 * Ne dépend pas du header x-user-data injecté par le middleware Next.js :
 * chaque route peut ainsi être protégée indépendamment (défense en profondeur),
 * et l'identité utilisée pour l'audit provient toujours du token vérifié,
 * jamais d'un en-tête que le client pourrait forger.
 */
export function requireAuth(request: NextRequest): AuthResult {
  try {
    const user = verifyAuth(request)
    return { authorized: true, user }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      authorized: false,
      response: NextResponse.json<ApiResponse>(
        { success: false, error: errorMessage },
        { status: 401 }
      ),
    }
  }
}

/**
 * Comme requireAuth, mais exige en plus un rôle administrateur.
 * À utiliser sur les endpoints sensibles : gestion des utilisateurs, des
 * rôles/permissions, et de la configuration de l'application.
 */
export function requireAdmin(request: NextRequest): AuthResult {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth

  if (!ADMIN_ROLES.includes(auth.user.role.toLowerCase())) {
    logger.warn("Forbidden API request - Insufficient role", {
      pathname: request.nextUrl.pathname,
      role: auth.user.role,
      email: auth.user.email,
    })
    return {
      authorized: false,
      response: NextResponse.json<ApiResponse>(
        { success: false, error: "Accès refusé. Droits administrateur requis." },
        { status: 403 }
      ),
    }
  }

  return auth
}

/**
 * Vérifie le token JWT et retourne les données utilisateur
 * @throws {Error} Si le token est invalide ou manquant
 */
export function verifyAuth(request: NextRequest): { id: string; email: string; firstName: string; lastName: string; role: string } {
  const authHeader = request.headers.get("authorization")
  const token = extractTokenFromHeader(authHeader)

  if (!token) {
    logger.warn("Unauthorized API request - No token provided", { pathname: request.nextUrl.pathname })
    throw new Error("Authentification requise. Token manquant.")
  }

  try {
    const payload = verifyAccessToken(token)
    logger.debug("Token verified", { email: payload.email })
    
    return {
      id: payload.userId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.warn("Unauthorized API request - Invalid token", { pathname: request.nextUrl.pathname, error: errorMessage })
    throw new Error(`Token invalide ou expiré: ${errorMessage}`)
  }
}

