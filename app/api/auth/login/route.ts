import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"
import { signAccessToken, signRefreshToken, signTwoFactorPendingToken } from "@/lib/auth"
import { loginRateLimiter } from "@/lib/rate-limiter"
import { logger } from "@/lib/logger"
import { sanitizeUser } from "@/lib/sanitize-user"
import { logAudit } from "@/lib/audit-logger"
import { getLoginSecuritySettings } from "@/lib/security-config"

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Appliquer le rate limiting pour les tentatives de connexion
    const rateLimitResponse = loginRateLimiter(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    logger.debug('Login API called')
    
    const body = await request.json()
    const { email, password } = body

    logger.debug('Login attempt', { email })

    if (!email || !password) {
      logger.warn('Missing email or password')
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email et mot de passe requis",
        },
        { status: 400 },
      )
    }

    // Chercher l'utilisateur par email
    logger.debug('Searching for user in database')
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      logger.warn('User not found', { email })
      await logAudit({
        userId: "unknown",
        userEmail: email,
        action: "login_failed",
        module: "auth",
        entityType: "user",
        entityName: email,
        details: `Tentative de connexion échouée pour ${email} (compte inexistant)`,
        status: "failure",
        errorMessage: "Utilisateur non trouvé",
      }, request)
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email ou mot de passe incorrect",
        },
        { status: 401 },
      )
    }

    logger.debug('User found', { email: user.email, isActive: user.isActive })

    // Vérifier que l'utilisateur est actif
    if (!user.isActive) {
      logger.warn('User account is inactive', { email })
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        action: "login_failed",
        module: "auth",
        entityType: "user",
        entityId: user.id,
        entityName: `${user.firstName} ${user.lastName}`,
        details: `Tentative de connexion refusée pour ${user.email} (compte désactivé)`,
        status: "failure",
        errorMessage: "Compte désactivé",
      }, request)
      return NextResponse.json<ApiResponse<{ accountDisabled: true }>>(
        {
          success: false,
          error: "Ce compte est désactivé",
          data: { accountDisabled: true },
        },
        { status: 403 },
      )
    }

    // Compte verrouillé suite à trop d'échecs de connexion récents : refuser
    // toute tentative (même avec le bon mot de passe) tant que le compte à
    // rebours n'est pas terminé, sauf réinitialisation du mot de passe.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      logger.warn('Account is locked out', { email, lockedUntil: user.lockedUntil })
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        action: "login_failed",
        module: "auth",
        entityType: "user",
        entityId: user.id,
        entityName: `${user.firstName} ${user.lastName}`,
        details: `Tentative de connexion refusée pour ${user.email} (compte temporairement verrouillé)`,
        status: "failure",
        errorMessage: "Compte verrouillé",
      }, request)
      return NextResponse.json<ApiResponse<{ locked: true; lockedUntil: string }>>(
        {
          success: false,
          error: "Compte temporairement verrouillé suite à plusieurs tentatives de connexion échouées.",
          data: { locked: true, lockedUntil: user.lockedUntil.toISOString() },
        },
        { status: 423 },
      )
    }

    // Vérifier le mot de passe
    logger.debug('Verifying password')
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      logger.warn('Invalid password', { email })

      const { maxLoginAttempts, lockoutDuration } = await getLoginSecuritySettings()
      const failedAttempts = user.failedLoginAttempts + 1

      if (failedAttempts >= maxLoginAttempts) {
        const lockedUntil = new Date(Date.now() + lockoutDuration * 60 * 1000)
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: failedAttempts, lockedUntil },
        })
        logger.warn('Account locked after too many failed attempts', { email, lockedUntil })
        await logAudit({
          userId: user.id,
          userEmail: user.email,
          action: "login_failed",
          module: "auth",
          entityType: "user",
          entityId: user.id,
          entityName: `${user.firstName} ${user.lastName}`,
          details: `Compte de ${user.email} verrouillé après ${failedAttempts} tentatives de connexion échouées`,
          status: "failure",
          errorMessage: "Trop de tentatives échouées",
        }, request)
        return NextResponse.json<ApiResponse<{ locked: true; lockedUntil: string }>>(
          {
            success: false,
            error: "Trop de tentatives échouées. Votre compte est temporairement verrouillé.",
            data: { locked: true, lockedUntil: lockedUntil.toISOString() },
          },
          { status: 423 },
        )
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: failedAttempts },
      })
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        action: "login_failed",
        module: "auth",
        entityType: "user",
        entityId: user.id,
        entityName: `${user.firstName} ${user.lastName}`,
        details: `Tentative de connexion échouée pour ${user.email} (mot de passe incorrect)`,
        status: "failure",
        errorMessage: "Mot de passe incorrect",
      }, request)
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email ou mot de passe incorrect",
        },
        { status: 401 },
      )
    }

    // Mot de passe correct : lever un éventuel compteur d'échecs résiduel.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      })
    }

    logger.info('Login successful', { email: user.email })
    console.log(`[Login API] ✓ Connexion réussie pour: ${user.email}`)

    // Si la double authentification est activée, ne pas émettre les tokens
    // tout de suite : le mot de passe seul ne suffit pas. On renvoie un jeton
    // temporaire (5 min) que le client devra présenter avec un code TOTP valide
    // sur /api/auth/2fa/verify-login pour obtenir les vrais tokens de session.
    if (user.twoFactorEnabled) {
      const tempToken = signTwoFactorPendingToken(user.id)

      // Un administrateur a rendu la 2FA obligatoire pour ce compte, mais
      // l'utilisateur n'a encore jamais configuré d'application
      // d'authentification (aucun secret confirmé) : on le force à la
      // configurer maintenant, avant tout accès au tableau de bord.
      if (!user.twoFactorSecret) {
        logger.info('Password valid, 2FA setup required before login', { email: user.email })
        return NextResponse.json<ApiResponse<{ requiresTwoFactorSetup: true; tempToken: string }>>({
          success: true,
          data: {
            requiresTwoFactorSetup: true,
            tempToken,
          },
          message: "Configuration de la double authentification requise",
        })
      }

      logger.info('Password valid, awaiting 2FA code', { email: user.email })
      return NextResponse.json<ApiResponse<{ requiresTwoFactor: true; tempToken: string }>>({
        success: true,
        data: {
          requiresTwoFactor: true,
          tempToken,
        },
        message: "Code de vérification requis",
      })
    }

    // Générer les tokens JWT
    console.log(`[Login API] Génération des tokens JWT...`)
    let accessToken: string
    let refreshToken: string

    try {
      accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      })
      console.log(`[Login API] ✓ Token d'accès généré`)

      refreshToken = signRefreshToken({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      })
      console.log(`[Login API] ✓ Token de rafraîchissement généré`)
    } catch (tokenError) {
      console.error(`[Login API] ERREUR lors de la génération des tokens:`, tokenError)
      logger.error('Token generation error', tokenError)
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Erreur lors de la génération des tokens: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`,
        },
        { status: 500 },
      )
    }

    console.log(`[Login API] ✓ Retour des tokens et données utilisateur`)
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "login",
      module: "auth",
      entityType: "user",
      entityId: user.id,
      entityName: `${user.firstName} ${user.lastName}`,
      details: `Connexion réussie de ${user.email}`,
      status: "success",
    }, request)

    // Retourner les tokens et les données utilisateur
    return NextResponse.json<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>>({
      success: true,
      data: {
        user: sanitizeUser(user) as User,
        accessToken,
        refreshToken,
      },
      message: "Connexion réussie",
    })
  } catch (error) {
    logger.error('Login error', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la connexion",
      },
      { status: 500 },
    )
  }
}