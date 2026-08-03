import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { AppConfig } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"
import { requireAuth, requireAdmin, isAdminRole } from "@/lib/auth-middleware"
import { normalizeNotificationSettings } from "@/lib/notification-settings"
import { normaliserMotifParType } from "@/lib/movement-reason-types"

// GET /api/config - Récupérer la configuration de l'application

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Retire les identifiants SMTP de la config renvoyée aux utilisateurs non-admin :
// de nombreuses pages appellent GET /api/config juste pour le logo/nom de société,
// mais le mot de passe SMTP en clair ne doit jamais être exposé à un compte non-admin.
function redactForNonAdmin(config: any): any {
  if (!config || typeof config !== "object") return config
  if (!config.smtp) return config
  return {
    ...config,
    smtp: {
      ...config.smtp,
      username: config.smtp.username ? "••••••••" : config.smtp.username,
      password: config.smtp.password ? "••••••••" : config.smtp.password,
    },
  }
}

// Ramène les réglages de notifications au format actuel (interrupteurs
// indépendants in-app/email par type) : nécessaire pour les configurations
// enregistrées avant l'introduction de ce format (simples booléens).
function withNormalizedNotifications(config: any): any {
  if (!config || typeof config !== "object") return config
  return {
    ...config,
    notifications: normalizeNotificationSettings(config.notifications),
  }
}

// Ramène security au format actuel : les configurations enregistrées avant
// l'introduction du minuteur d'inactivité portaient sessionDuration, un champ
// jamais branché à la moindre logique, au lieu des deux délais actuels.
function withSecurityDefaults(config: any): any {
  if (!config || typeof config !== "object" || !config.security) return config
  const { sessionDuration, ...security } = config.security
  return {
    ...config,
    security: { idleSessionEnabled: true, idleWarningMinutes: 15, idleLogoutMinutes: 5, ...security },
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (!auth.authorized) return auth.response
  const canSeeSecrets = isAdminRole(auth.user.role)

  try {
    const config = await prisma.appConfig.findUnique({
      where: { id: 'singleton' }
    })

    if (!config) {
      // Créer une configuration par défaut si elle n'existe pas
      const defaultConfig = await prisma.appConfig.create({
        data: {
          id: 'singleton',
          config: {
            general: {
              companyName: 'Monetique Tunisie',
              logo: '/images/monetique-logo.png',
              language: 'fr',
              currency: 'TND',
              timezone: 'Africa/Tunis'
            },
            smtp: {
              host: 'smtp.gmail.com',
              port: 587,
              secure: false,
              username: '',
              password: '',
              fromEmail: 'noreply@monetique.tn',
              fromName: 'Monetique Tunisie'
            },
            notifications: {
              enabled: true,
              lowStockAlerts: { inApp: true, email: true },
              movementNotifications: { inApp: true, email: true },
              userActivityAlerts: { inApp: true, email: true },
              accountEmails: {
                welcomeEmail: true,
                passwordResetEmail: true,
                passwordChangedEmail: true,
                authMethodChangedEmail: true
              },
              lowStockThreshold: 100,
              criticalStockThreshold: 50,
              emailNotifications: true,
              inAppNotifications: true,
              emailRecipients: []
            },
            display: {
              dateFormat: 'DD/MM/YYYY',
              timeFormat: '24h',
              numberFormat: 'fr-TN',
              itemsPerPage: 10,
              theme: 'auto'
            },
            security: {
              idleSessionEnabled: true,
              idleWarningMinutes: 15,
              idleLogoutMinutes: 5,
              requireStrongPassword: true,
              minPasswordLength: 8,
              twoFactor: {
                enabled: false,
                appName: 'Monetique Tunisie',
                issuer: 'Monetique',
                codeLength: 6,
                codePeriod: 30,
                algorithm: 'SHA1',
                mandatory: false,
                mandatoryRoles: [],
                gracePeriodDays: 7
              },
              maxLoginAttempts: 5,
              lockoutDuration: 30
            }
          }
        }
      })
      
      return NextResponse.json<ApiResponse<AppConfig>>({
        success: true,
        data: (canSeeSecrets
          ? withNormalizedNotifications(defaultConfig.config)
          : redactForNonAdmin(withNormalizedNotifications(defaultConfig.config))) as unknown as AppConfig,
      })
    }

    const configNormalise = withSecurityDefaults(withNormalizedNotifications(config.config))
    return NextResponse.json<ApiResponse<AppConfig>>({
      success: true,
      data: (canSeeSecrets ? configNormalise : redactForNonAdmin(configNormalise)) as unknown as AppConfig,
    })
  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de la configuration",
      },
      { status: 500 },
    )
  }
}

// PUT /api/config - Mettre à jour la configuration
export async function PUT(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response
  const userData = auth.user

  try {
    const body = await request.json()

    // La correspondance « type de mouvement -> motif » appartient à l'écran des
    // motifs, qui l'enregistre par sa propre route. Cet écran-ci réécrit tout le
    // JSON à partir d'un état chargé à l'ouverture de la page : sans cette
    // protection, attribuer un type puis cliquer sur « Enregistrer » effacerait
    // l'attribution qu'on vient de faire. On repart donc toujours de la valeur
    // stockée, jamais de celle envoyée par le client.
    const existant = await prisma.appConfig.findUnique({ where: { id: 'singleton' } })
    const mouvementsStockes = ((existant?.config ?? {}) as Record<string, unknown>).movements ?? {}
    const config = {
      ...body,
      movements: {
        ...(mouvementsStockes as Record<string, unknown>),
        reasonByType: normaliserMotifParType(
          (mouvementsStockes as Record<string, unknown>).reasonByType,
        ),
      },
    }

    const updatedConfig = await prisma.appConfig.upsert({
      where: { id: 'singleton' },
      update: {
        config
      },
      create: {
        id: 'singleton',
        config
      }
    })

    // Logger l'action (toujours créer un log)
    await logAudit({
      userId: userData?.id || "system",
      userEmail: userData?.email || "system@monetique.tn",
      action: "update",
      module: "config",
      entityType: "config",
      entityId: 'singleton',
      entityName: "Configuration de l'application",
      details: `Modification de la configuration de l'application${userData ? ` par ${userData.email}` : ' (utilisateur non identifié)'}`,
      status: "success"
    }, request)

    return NextResponse.json<ApiResponse<AppConfig>>({
      success: true,
      data: updatedConfig.config as unknown as AppConfig,
      message: "Configuration mise à jour avec succès",
    })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de la configuration",
      },
      { status: 500 },
    )
  }
}