import { prisma } from "@/lib/db"
import { normaliserMotifParType, type MotifParType } from "@/lib/movement-reason-types"

// Accès à la correspondance « type de mouvement -> motif » rangée dans la
// configuration applicative (app_config.config, une colonne JSON). Aucune
// colonne dédiée n'est nécessaire : c'est un réglage, pas une donnée métier, et
// cela évite une migration sur une base de production.

const CLE_CONFIG = "singleton"

export async function lireMotifParType(): Promise<MotifParType> {
  const enregistrement = await prisma.appConfig.findUnique({ where: { id: CLE_CONFIG } })
  const config = (enregistrement?.config ?? {}) as Record<string, unknown>
  const mouvements = (config.movements ?? {}) as Record<string, unknown>

  return normaliserMotifParType(mouvements.reasonByType)
}

export async function ecrireMotifParType(correspondance: MotifParType): Promise<void> {
  const enregistrement = await prisma.appConfig.findUnique({ where: { id: CLE_CONFIG } })
  const config = (enregistrement?.config ?? {}) as Record<string, unknown>
  const mouvements = (config.movements ?? {}) as Record<string, unknown>

  // On réécrit la configuration entière : il faut donc repartir de l'existante
  // pour ne pas effacer les autres sections (SMTP, notifications, affichage...).
  const nouvelleConfig = {
    ...config,
    movements: { ...mouvements, reasonByType: correspondance },
  }

  await prisma.appConfig.upsert({
    where: { id: CLE_CONFIG },
    update: { config: nouvelleConfig as never },
    create: { id: CLE_CONFIG, config: nouvelleConfig as never },
  })
}
