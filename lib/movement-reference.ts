// Numéro de bordereau : BM-AAAAMMJJ-XXXXXX.
//
// Tiré au sort plutôt que séquentiel, comme demandé. L'unicité n'est pas
// laissée à la charge du tirage : la colonne porte une contrainte d'unicité et
// la création réessaie en cas de collision (voir creerAvecReference).

// Alphabet sans les caractères que l'on confond en lisant un document papier :
// ni 0/O, ni 1/I/L. Il reste 32 symboles, soit plus d'un milliard de
// combinaisons pour un suffixe de 6 caractères.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export const LONGUEUR_SUFFIXE = 6

export function genererReferenceMouvement(date: Date = new Date()): string {
  const jour = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("")

  let suffixe = ""
  for (let i = 0; i < LONGUEUR_SUFFIXE; i += 1) {
    suffixe += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }

  return `BM-${jour}-${suffixe}`
}

/** Vrai si la chaîne a la forme d'un numéro de bordereau. */
export function estReferenceMouvement(valeur: string): boolean {
  return new RegExp(`^BM-\\d{8}-[${ALPHABET}]{${LONGUEUR_SUFFIXE}}$`).test(valeur)
}

/**
 * Crée un enregistrement en lui attribuant une référence, en réessayant si le
 * tirage entre en collision avec une référence existante (code Prisma P2002).
 * Sans cette reprise, une collision — rare mais possible — ferait échouer un
 * mouvement légitime.
 */
export async function creerAvecReference<T>(
  creer: (reference: string) => Promise<T>,
  options: { date?: Date; tentatives?: number } = {},
): Promise<T> {
  const tentatives = options.tentatives ?? 5

  for (let essai = 1; essai <= tentatives; essai += 1) {
    try {
      return await creer(genererReferenceMouvement(options.date))
    } catch (erreur) {
      const collision =
        typeof erreur === "object" &&
        erreur !== null &&
        (erreur as { code?: string }).code === "P2002" &&
        String((erreur as { meta?: { target?: unknown } }).meta?.target ?? "").includes("reference")

      if (!collision || essai === tentatives) throw erreur
    }
  }

  // Inatteignable : la boucle rend ou relance à la dernière tentative.
  throw new Error("Impossible d'attribuer une référence de mouvement")
}
