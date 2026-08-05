import { describe, expect, it } from "vitest"
import { parseCsvLine } from "@/lib/csv"

describe("parseCsvLine", () => {
  it("découpe une ligne simple sans guillemets", () => {
    expect(parseCsvLine("AMEN;Amen Bank;Tunisie", ";")).toEqual(["AMEN", "Amen Bank", "Tunisie"])
  })

  // Le bug corrigé ici : un champ contenant le délimiteur, entre guillemets,
  // ne doit pas être coupé en deux champs distincts.
  it("ne coupe pas un champ entre guillemets contenant le délimiteur", () => {
    expect(parseCsvLine('AMEN;"Rue X; Bloc B";Tunisie', ";")).toEqual(["AMEN", "Rue X; Bloc B", "Tunisie"])
  })

  it("retire les guillemets qui entourent un champ", () => {
    expect(parseCsvLine('"Amen Bank";AMEN', ";")).toEqual(["Amen Bank", "AMEN"])
  })

  it("interprète un guillemet doublé comme un guillemet littéral", () => {
    expect(parseCsvLine('"Agence ""Centre""";AMEN', ";")).toEqual(['Agence "Centre"', "AMEN"])
  })

  it("gère les champs vides", () => {
    expect(parseCsvLine("AMEN;;Tunisie", ";")).toEqual(["AMEN", "", "Tunisie"])
  })

  it("fonctionne avec la virgule comme délimiteur", () => {
    expect(parseCsvLine('AMEN,"Rue X, Bloc B",Tunisie', ",")).toEqual(["AMEN", "Rue X, Bloc B", "Tunisie"])
  })
})
