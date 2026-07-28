import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"

import { clearToasts } from "./hooks/use-toast"

// Les notifications vivent dans un état de module partagé par tous les tests
// d'un même fichier : une notification laissée ouverte réapparaîtrait dans le
// test suivant et rendrait ambigus les `findByText`.
afterEach(() => {
  clearToasts()
})

// Remplace toute implémentation native de localStorage (celle de jsdom, ou
// celle, expérimentale et parfois incomplète selon la version de Node,
// exposée nativement par Node 22+ - ex. .clear()/.removeItem() absents sans
// fichier de stockage configuré) par une implémentation simple et complète en
// mémoire, pour un comportement déterministe quel que soit l'environnement.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

try {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  })
} catch (error) {
  console.warn("Impossible de remplacer globalThis.localStorage dans les tests:", error)
}
