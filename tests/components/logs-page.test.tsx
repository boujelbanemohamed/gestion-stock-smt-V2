import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import LogsPage from "@/app/dashboard/logs/page"

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

describe("LogsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("rend la page des logs d'audit (route /dashboard/logs) sans erreur", async () => {
    // Cette page ne faisait que 404 : le fichier app/dashboard/logs/page.tsx
    // n'existait pas alors que le composant LogsPanel et la route API
    // /api/logs existaient déjà tous les deux.
    const admin = { id: "u1", email: "admin@example.com", firstName: "Admin", lastName: "System", role: "admin" }
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/logs")) return jsonResponse({ success: true, data: [], total: 0 })
        if (url.includes("/api/users")) return jsonResponse({ success: true, data: [admin] })
        throw new Error(`Unexpected fetch to ${url}`)
      }),
    )

    render(<LogsPage />)

    expect(await screen.findByText("Logs d'audit")).toBeInTheDocument()
  })
})
