import { prisma } from "@/lib/db"
import type { TwoFactorSettings } from "@/lib/types"

const DEFAULT_TWO_FACTOR_SETTINGS: TwoFactorSettings = {
  enabled: false,
  appName: "Monetique Tunisie",
  issuer: "Monetique",
  codeLength: 6,
  codePeriod: 30,
  algorithm: "SHA1",
  mandatory: false,
  mandatoryRoles: [],
  gracePeriodDays: 7,
}

/**
 * Récupère les paramètres 2FA configurés dans Configuration > Sécurité
 * (Configuration > Sécurité étant stockée en JSON, un champ manquant retombe
 * sur une valeur par défaut plutôt que de faire échouer la génération/vérification TOTP).
 */
export async function getTwoFactorSettings(): Promise<TwoFactorSettings> {
  const config = await prisma.appConfig.findUnique({ where: { id: "singleton" } })
  const twoFactor = (config?.config as any)?.security?.twoFactor
  return { ...DEFAULT_TWO_FACTOR_SETTINGS, ...(twoFactor || {}) }
}
