import { describe, expect, it, vi } from "vitest"

import {
  creerAvecReference,
  estReferenceMouvement,
  genererReferenceMouvement,
} from "@/lib/movement-reference"

describe("référence de mouvement", () => {
  it("porte la date du mouvement et un suffixe de 6 caractères", () => {
    const reference = genererReferenceMouvement(new Date(2026, 6, 29, 10, 12))

    expect(reference).toMatch(/^BM-20260729-[A-Z2-9]{6}$/)
    expect(estReferenceMouvement(reference)).toBe(true)
  })

  // Le numéro est recopié à la main depuis un bordereau papier : les caractères
  // que l'on confond à la lecture sont exclus de l'alphabet.
  it("n'emploie aucun caractère ambigu (0, O, 1, I, L)", () => {
    const suffixes = Array.from({ length: 300 }, () => genererReferenceMouvement().slice(-6)).join("")

    expect(suffixes).not.toMatch(/[01OIL]/)
  })

  it("ne produit pas deux fois le même numéro sur un grand tirage", () => {
    const tirages = new Set(Array.from({ length: 2000 }, () => genererReferenceMouvement()))

    expect(tirages.size).toBe(2000)
  })

  it("refuse une chaîne qui n'a pas la forme attendue", () => {
    expect(estReferenceMouvement("BM-20260729-ABC")).toBe(false)
    expect(estReferenceMouvement("cmu5v5bv900098acbla2nf0xn")).toBe(false)
    expect(estReferenceMouvement("BM-20260729-ABC0IL")).toBe(false)
  })
})

describe("creerAvecReference", () => {
  it("transmet une référence à la fonction de création", async () => {
    const creer = vi.fn().mockResolvedValue({ ok: true })

    await creerAvecReference(creer)

    expect(creer).toHaveBeenCalledTimes(1)
    expect(estReferenceMouvement(creer.mock.calls[0][0])).toBe(true)
  })

  // Une collision est improbable mais possible : sans reprise, elle ferait
  // échouer un mouvement parfaitement légitime.
  it("rejoue avec un nouveau tirage quand la base signale un doublon", async () => {
    const doublon = Object.assign(new Error("doublon"), {
      code: "P2002",
      meta: { target: ["reference"] },
    })
    const creer = vi
      .fn()
      .mockRejectedValueOnce(doublon)
      .mockRejectedValueOnce(doublon)
      .mockResolvedValue({ ok: true })

    await expect(creerAvecReference(creer)).resolves.toEqual({ ok: true })
    expect(creer).toHaveBeenCalledTimes(3)
    // Chaque tentative emploie un numéro différent.
    const tentes = creer.mock.calls.map((appel) => appel[0])
    expect(new Set(tentes).size).toBe(3)
  })

  it("abandonne après le nombre de tentatives prévu", async () => {
    const doublon = Object.assign(new Error("doublon"), {
      code: "P2002",
      meta: { target: ["reference"] },
    })
    const creer = vi.fn().mockRejectedValue(doublon)

    await expect(creerAvecReference(creer, { tentatives: 3 })).rejects.toThrow("doublon")
    expect(creer).toHaveBeenCalledTimes(3)
  })

  // Une erreur de stock ne doit pas être confondue avec une collision : la
  // rejouer masquerait le vrai problème.
  it("ne rejoue pas une erreur qui n'est pas un doublon de référence", async () => {
    const creer = vi.fn().mockRejectedValue(new Error("Stock insuffisant à l'emplacement"))

    await expect(creerAvecReference(creer)).rejects.toThrow("Stock insuffisant")
    expect(creer).toHaveBeenCalledTimes(1)
  })

  it("ne rejoue pas un doublon portant sur une autre colonne", async () => {
    const autre = Object.assign(new Error("doublon"), {
      code: "P2002",
      meta: { target: ["email"] },
    })
    const creer = vi.fn().mockRejectedValue(autre)

    await expect(creerAvecReference(creer)).rejects.toThrow("doublon")
    expect(creer).toHaveBeenCalledTimes(1)
  })
})
