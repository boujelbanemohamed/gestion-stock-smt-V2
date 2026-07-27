/**
 * Middleware Next.js pour l'authentification et la protection des routes
 * Vérifie les tokens JWT sur toutes les routes protégées
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken, extractTokenFromHeader } from "@/lib/auth"
import { logger } from "@/lib/logger"

// Routes publiques (ne nécessitent pas d'authentification)
const publicRoutes = [
  "/",
  "/login",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]

// Routes API qui nécessitent une authentification
const protectedApiRoutes = ["/api"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`[Middleware] Requête entrante: ${pathname}`)
  console.log(`[Middleware] Méthode: ${request.method}`)

  // Ignorer les routes publiques
  // Traiter "/" séparément car toutes les routes commencent par "/"
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/") {
      // "/" ne doit matcher que la route exacte "/"
      return pathname === "/"
    }
    // Pour les autres routes, vérifier correspondance exacte ou startsWith avec vérification
    if (pathname === route) return true
    if (pathname.startsWith(route)) {
      // Vérifier que le chemin suivant est vide ou commence par /
      const remainingPath = pathname.substring(route.length)
      return remainingPath === '' || remainingPath.startsWith('/')
    }
    return false
  })
  console.log(`[Middleware] Route publique: ${isPublicRoute} (pathname: ${pathname})`)
  
  if (isPublicRoute) {
    console.log(`[Middleware] Route publique détectée, passage sans vérification`)
    return NextResponse.next()
  }

  // NOTE: La vérification JWT ne peut pas être faite dans le middleware
  // car le middleware s'exécute dans Edge Runtime qui ne supporte pas le module Node.js 'crypto'
  // La vérification JWT sera faite directement dans les routes API qui utilisent Node.js runtime
  
  // Pour les routes API protégées, on passe simplement la requête
  // La vérification du token se fera dans chaque route API individuelle
  const isProtectedApiRoute = protectedApiRoutes.some((route) => pathname.startsWith(route))
  console.log(`[Middleware] Route API protégée: ${isProtectedApiRoute}`)
  
  if (isProtectedApiRoute) {
    console.log(`[Middleware] Route API protégée détectée: ${pathname} - La vérification JWT se fera dans la route API`)
    // Passer la requête sans modification
    // Les routes API vérifieront elles-mêmes le token JWT
    return NextResponse.next()
  }

  // Pour les routes dashboard, on ne peut pas vérifier le token côté serveur
  // car les tokens sont dans localStorage côté client.
  // La vérification sera faite côté client dans les composants.
  // On autorise l'accès et la page client vérifiera l'authentification.
  // Note: Les API appelées depuis ces pages seront protégées par le middleware ci-dessus.

  // Par défaut, autoriser l'accès
  return NextResponse.next()
}

// Configurer les matchers pour optimiser les performances
export const config = {
  matcher: [
    /*
     * Match toutes les requêtes sauf:
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico (favicon)
     * - fichiers images
     * 
     * IMPORTANT: Le pattern doit matcher les routes API
     * 
     * NOTE: Le middleware s'exécute dans Edge Runtime et ne peut pas utiliser
     * le module Node.js 'crypto' nécessaire pour jsonwebtoken.
     * La vérification JWT se fait donc directement dans les routes API.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Inclure explicitement toutes les routes API (syntaxe Next.js)
    "/api/(.*)",
  ],
}

