import type { MovementReason } from "@/lib/types"

// Correspondance « type de mouvement -> motif pré-sélectionné ».
//
// Elle est volontairement stockée sous forme d'un objet à exactement trois
// clés, une par type de mouvement. C'est cette forme qui garantit la règle
// métier : on ne peut pas attribuer un type à plus de motifs qu'il n'existe de
// types de mouvement, et un même type ne peut jamais désigner deux motifs.
// Aucune validation applicative n'est nécessaire pour cela — c'est la structure
// de données elle-même qui rend l'état interdit inexprimable.
//
// Le motif est référencé par son identifiant, jamais par son libellé : renommer
// un motif conserve donc la correspondance.

export const TYPES_MOUVEMENT = ["entry", "exit", "transfer"] as const

export type TypeMouvement = (typeof TYPES_MOUVEMENT)[number]

export const LIBELLE_TYPE_MOUVEMENT: Record<TypeMouvement, string> = {
  entry: "Entrée",
  exit: "Sortie",
  transfer: "Transfert",
}

export type MotifParType = Record<TypeMouvement, string | null>

export const MOTIF_PAR_TYPE_VIDE: MotifParType = {
  entry: null,
  exit: null,
  transfer: null,
}

export function estTypeMouvement(valeur: unknown): valeur is TypeMouvement {
  return typeof valeur === "string" && (TYPES_MOUVEMENT as readonly string[]).includes(valeur)
}

/**
 * Ramène une valeur venue de la base (JSON libre) à la forme attendue :
 * exactement trois clés, des identifiants ou null. Toute clé inconnue est
 * ignorée — une configuration enregistrée avant cette fonctionnalité, ou
 * modifiée à la main, ne peut donc pas introduire une quatrième correspondance.
 */
export function normaliserMotifParType(brut: unknown): MotifParType {
  const source = (brut ?? {}) as Record<string, unknown>
  const resultat: MotifParType = { ...MOTIF_PAR_TYPE_VIDE }

  for (const type of TYPES_MOUVEMENT) {
    const valeur = source[type]
    resultat[type] = typeof valeur === "string" && valeur.trim() !== "" ? valeur : null
  }

  return resultat
}

/**
 * Écarte les correspondances qui ne désignent plus un motif utilisable :
 * motif supprimé entre-temps, ou motif « Autre » (qui ouvre une saisie libre et
 * ne peut donc pas servir de pré-remplissage).
 */
export function resoudreMotifParType(
  correspondance: MotifParType,
  motifs: Pick<MovementReason, "id" | "isOther">[],
): MotifParType {
  const utilisables = new Set(motifs.filter((motif) => !motif.isOther).map((motif) => motif.id))
  const resultat: MotifParType = { ...MOTIF_PAR_TYPE_VIDE }

  for (const type of TYPES_MOUVEMENT) {
    const identifiant = correspondance[type]
    resultat[type] = identifiant && utilisables.has(identifiant) ? identifiant : null
  }

  return resultat
}

/** Type de mouvement attribué à un motif, ou null s'il n'en porte aucun. */
export function typeDuMotif(correspondance: MotifParType, motifId: string): TypeMouvement | null {
  return TYPES_MOUVEMENT.find((type) => correspondance[type] === motifId) ?? null
}

/**
 * Attribue `type` au motif `motifId`, ou le libère si `type` vaut null.
 *
 * Un motif ne porte qu'un seul type : l'ancien est donc libéré. Et un type ne
 * désigne qu'un seul motif : s'il était pris par un autre, il lui est retiré.
 * L'interface empêche déjà de choisir un type occupé ; cette reprise garantit
 * la cohérence même si deux administrateurs enregistrent en même temps.
 */
export function attribuerType(
  correspondance: MotifParType,
  motifId: string,
  type: TypeMouvement | null,
): MotifParType {
  const resultat: MotifParType = { ...correspondance }

  for (const candidat of TYPES_MOUVEMENT) {
    if (resultat[candidat] === motifId) resultat[candidat] = null
  }

  if (type) resultat[type] = motifId

  return resultat
}
