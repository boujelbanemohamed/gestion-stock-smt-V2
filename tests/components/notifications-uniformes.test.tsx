import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { render, screen } from "@testing-library/react"

import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/hooks/use-toast"

const RACINE = join(__dirname, "..", "..")
const DOSSIERS = ["app", "components", "hooks", "lib"]

function fichiersSource(dossier: string): string[] {
  const resultat: string[] = []
  for (const entree of readdirSync(dossier)) {
    if (entree === "node_modules" || entree.startsWith(".")) continue
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) {
      resultat.push(...fichiersSource(chemin))
    } else if (/\.tsx?$/.test(entree)) {
      resultat.push(chemin)
    }
  }
  return resultat
}

// Retire commentaires et chaînes : sans cela, une mention de « alert( » dans un
// commentaire explicatif ferait échouer le test.
function codeSeul(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
}

describe("uniformité des notifications", () => {
  // window.alert() et window.confirm() affichent une boîte du navigateur : non
  // stylée, préfixée du nom de domaine, bloquante, hors charte. Elles ont toutes
  // été remplacées par toast() et useConfirmation() — ce test empêche leur retour.
  it("n'utilise plus aucune boîte de dialogue native du navigateur", () => {
    const fautifs: string[] = []

    for (const dossier of DOSSIERS) {
      for (const fichier of fichiersSource(join(RACINE, dossier))) {
        const code = codeSeul(readFileSync(fichier, "utf-8"))
        for (const [index, ligne] of code.split("\n").entries()) {
          if (/(^|[^.\w])(alert|confirm)\s*\(/.test(ligne)) {
            fautifs.push(`${relative(RACINE, fichier)}:${index + 1}`)
          }
        }
      }
    }

    expect(fautifs, `alert()/confirm() natifs à remplacer par toast()/useConfirmation() :\n${fautifs.join("\n")}`).toEqual([])
  })

  it("n'expose qu'une seule implémentation de notification", () => {
    const fichiers = DOSSIERS.flatMap((dossier) => fichiersSource(join(RACINE, dossier)))
    const doublons = fichiers.filter((fichier) =>
      /components\/ui\/(sonner|use-toast)\.tsx?$/.test(fichier.replace(/\\/g, "/")),
    )

    expect(doublons.map((f) => relative(RACINE, f))).toEqual([])
  })

  it("importe toast depuis @/hooks/use-toast partout", () => {
    const mauvaisImports: string[] = []

    for (const dossier of DOSSIERS) {
      for (const fichier of fichiersSource(join(RACINE, dossier))) {
        const source = readFileSync(fichier, "utf-8")
        if (/from ["']@\/components\/ui\/use-toast["']|from ["']sonner["']/.test(source)) {
          mauvaisImports.push(relative(RACINE, fichier))
        }
      }
    }

    expect(mauvaisImports).toEqual([])
  })
})

describe("rendu des notifications", () => {
  it("affiche une icône distincte selon la variante", async () => {
    render(<Toaster />)

    toast({ title: "Banque créée", variant: "success" })
    const succes = await screen.findByText("Banque créée")
    const cadreSucces = succes.closest("li") as HTMLElement
    expect(cadreSucces.className).toContain("border-emerald-600")
    expect(cadreSucces.querySelector("svg")).toBeTruthy()

    toast({ title: "Suppression impossible", variant: "destructive" })
    const erreur = await screen.findByText("Suppression impossible")
    const cadreErreur = erreur.closest("li") as HTMLElement
    expect(cadreErreur.className).toContain("border-destructive")
  })

  it("conserve les retours à la ligne d'une description multiligne", async () => {
    render(<Toaster />)

    toast({ title: "Import terminé", description: "2 lignes créées\n1 ligne ignorée" })

    const description = await screen.findByText(/1 ligne ignorée/)
    expect(description.className).toContain("whitespace-pre-line")
  })
})
