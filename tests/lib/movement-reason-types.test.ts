import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  attribuerType,
  MOTIF_PAR_TYPE_VIDE,
  normaliserMotifParType,
  resoudreMotifParType,
  TYPES_MOUVEMENT,
  typeDuMotif,
} from "@/lib/movement-reason-types"

const RACINE = join(__dirname, "..", "..")

describe("correspondance type de mouvement -> motif", () => {
  it("ne retient jamais plus de correspondances qu'il n'existe de types", () => {
    // Une configuration trafiquée ou héritée ne doit pas pouvoir introduire une
    // quatrième correspondance : c'est la règle métier demandée.
    const correspondance = normaliserMotifParType({
      entry: "r1",
      exit: "r2",
      transfer: "r3",
      inventaire: "r4",
      "": "r5",
    })

    expect(Object.keys(correspondance).sort()).toEqual([...TYPES_MOUVEMENT].sort())
    expect(Object.keys(correspondance)).toHaveLength(3)
  })

  it("comble une configuration absente ou partielle", () => {
    expect(normaliserMotifParType(undefined)).toEqual(MOTIF_PAR_TYPE_VIDE)
    expect(normaliserMotifParType({ exit: "r2" })).toEqual({ entry: null, exit: "r2", transfer: null })
    expect(normaliserMotifParType({ entry: "   " })).toEqual(MOTIF_PAR_TYPE_VIDE)
  })

  it("libère le type d'un motif supprimé entre-temps", () => {
    const correspondance = { entry: "r1", exit: "supprime", transfer: null }
    const motifs = [{ id: "r1", isOther: false }]

    expect(resoudreMotifParType(correspondance, motifs)).toEqual({
      entry: "r1",
      exit: null,
      transfer: null,
    })
  })

  it("ignore une correspondance qui désignerait le motif « Autre »", () => {
    const correspondance = { entry: "autre", exit: null, transfer: null }
    const motifs = [{ id: "autre", isOther: true }]

    expect(resoudreMotifParType(correspondance, motifs).entry).toBeNull()
  })

  it("retire le type au motif qui le portait quand on l'attribue à un autre", () => {
    const avant = { entry: null, exit: "r1", transfer: null }
    const apres = attribuerType(avant, "r2", "exit")

    expect(apres).toEqual({ entry: null, exit: "r2", transfer: null })
    expect(typeDuMotif(apres, "r1")).toBeNull()
    expect(typeDuMotif(apres, "r2")).toBe("exit")
  })

  it("n'attribue qu'un seul type par motif", () => {
    const avant = { entry: "r1", exit: null, transfer: null }
    const apres = attribuerType(avant, "r1", "transfer")

    expect(apres).toEqual({ entry: null, exit: null, transfer: "r1" })
  })

  it("libère le type quand on choisit « aucun »", () => {
    const avant = { entry: "r1", exit: null, transfer: null }

    expect(attribuerType(avant, "r1", null)).toEqual(MOTIF_PAR_TYPE_VIDE)
  })
})

// Garde-fou explicitement demandé : les bordereaux déjà générés ne doivent
// jamais changer. C'est le cas tant que le motif est COPIÉ sur le mouvement au
// moment de sa création. Si quelqu'un remplaçait un jour cette colonne par une
// relation vers movement_reasons, renommer un motif réécrirait tout
// l'historique et les bons réimprimés ne correspondraient plus aux originaux.
describe("historique des mouvements", () => {
  const schema = readFileSync(join(RACINE, "prisma", "schema.prisma"), "utf-8")

  function bloc(nomModele: string) {
    const debut = schema.indexOf(`model ${nomModele} {`)
    expect(debut, `le modèle ${nomModele} doit exister`).toBeGreaterThan(-1)
    return schema.slice(debut, schema.indexOf("\n}", debut))
  }

  it("stocke le motif d'un mouvement en texte, pas en référence", () => {
    const movement = bloc("Movement")

    expect(movement).toMatch(/^\s*reason\s+String\s*$/m)
    expect(movement).not.toMatch(/reasonId/)
    expect(movement).not.toMatch(/MovementReason/)
  })

  it("ne relie aucun modèle à MovementReason", () => {
    // Une relation apparaîtrait des deux côtés : ni Movement ni MovementReason
    // ne doivent en déclarer une.
    expect(bloc("MovementReason")).not.toMatch(/Movement\[\]/)
  })
})
