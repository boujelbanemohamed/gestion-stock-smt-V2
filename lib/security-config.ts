import { prisma } from "@/lib/db"

const DEFAULT_LOGIN_SECURITY_SETTINGS = {
  maxLoginAttempts: 5,
  lockoutDuration: 30, // minutes
}

/**
 * Récupère les paramètres de verrouillage de compte configurés dans
 * Configuration > Sécurité (nombre de tentatives avant verrouillage, et
 * durée du verrouillage). Retombe sur des valeurs par défaut si la
 * configuration n'existe pas encore ou ne définit pas ces champs.
 */
export async function getLoginSecuritySettings(): Promise<{ maxLoginAttempts: number; lockoutDuration: number }> {
  const config = await prisma.appConfig.findUnique({ where: { id: "singleton" } })
  const security = (config?.config as any)?.security

  return {
    maxLoginAttempts: security?.maxLoginAttempts ?? DEFAULT_LOGIN_SECURITY_SETTINGS.maxLoginAttempts,
    lockoutDuration: security?.lockoutDuration ?? DEFAULT_LOGIN_SECURITY_SETTINGS.lockoutDuration,
  }
}
