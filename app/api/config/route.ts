import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { AppConfig } from "@/lib/types"
import { logAudit } from "@/lib/audit-logger"

// GET /api/config - Récupérer la configuration de l'application
export async function GET(request: NextRequest) {
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
              lowStockAlerts: true,
              movementNotifications: true,
              userActivityAlerts: true,
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
              sessionDuration: 480,
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
        data: defaultConfig.config as unknown as AppConfig,
      })
    }

    return NextResponse.json<ApiResponse<AppConfig>>({
      success: true,
      data: config.config as unknown as AppConfig,
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
  try {
    const body = await request.json()

    // Récupérer l'utilisateur depuis le header
    const userHeader = request.headers.get("x-user-data")
    const userData = userHeader ? JSON.parse(userHeader) : null

    const updatedConfig = await prisma.appConfig.upsert({
      where: { id: 'singleton' },
      update: {
        config: body
      },
      create: {
        id: 'singleton',
        config: body
      }
    })

    // Logger l'action
    if (userData) {
      await logAudit({
        userId: userData.id,
        userEmail: userData.email,
        action: "update",
        module: "config",
        entityType: "config",
        entityId: 'singleton',
        entityName: "Configuration de l'application",
        details: `Modification de la configuration de l'application`,
        status: "success"
      }, request)
    }

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