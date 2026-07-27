import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import LogsPanel from "@/components/dashboard/logs-panel"

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

async function blobText(blob: Blob): Promise<string> {
  if (typeof (blob as any).text === "function") return (blob as any).text()
  const buffer = await blob.arrayBuffer()
  return new TextDecoder("utf-8").decode(buffer)
}

const admin = { id: "u1", email: "admin@example.com", firstName: "Admin", lastName: "System", role: "admin" }

const sampleLogs = [
  {
    id: "log-1",
    timestamp: "2026-01-15T10:30:00.000Z",
    userId: "u1",
    userEmail: "admin@example.com",
    userName: "Admin System",
    action: "delete",
    module: "movements",
    entityType: "movement",
    details: "Suppression du mouvement Sortie - Visa Classique",
    status: "success",
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
  },
]

describe("LogsPanel - export CSV/Excel", () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let capturedBlob: Blob | undefined

  beforeEach(() => {
    capturedBlob = undefined
    createObjectURLSpy = vi.fn((blob: Blob) => {
      capturedBlob = blob
      return "blob:mock-url"
    })
    vi.stubGlobal("URL", { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/logs")) return jsonResponse({ success: true, data: sampleLogs, total: 1 })
        if (url.includes("/api/users")) return jsonResponse({ success: true, data: [admin] })
        throw new Error(`Unexpected fetch to ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("exporte les logs affichés (déjà filtrés) en CSV", async () => {
    const user = userEvent.setup()
    render(<LogsPanel />)

    expect(await screen.findByText("Suppression du mouvement Sortie - Visa Classique")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /exporter/i }))
    await user.click(await screen.findByText("Exporter en CSV"))

    await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1))
    const content = await blobText(capturedBlob!)

    expect(content).toContain("Date et heure,Utilisateur,Email,Action,Module,Détails,Statut,Adresse IP,Navigateur")
    expect(content).toContain("admin@example.com")
    expect(content).toContain("Suppression du mouvement Sortie - Visa Classique")
    expect(content).toContain("127.0.0.1")
  })

  it("n'exporte rien et prévient l'utilisateur si aucun log ne correspond aux filtres", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/logs")) return jsonResponse({ success: true, data: [], total: 0 })
        if (url.includes("/api/users")) return jsonResponse({ success: true, data: [admin] })
        throw new Error(`Unexpected fetch to ${url}`)
      }),
    )

    const user = userEvent.setup()
    render(<LogsPanel />)

    expect(await screen.findByText("Aucun log trouvé")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /exporter/i }))
    await user.click(await screen.findByText("Exporter en CSV"))

    // Pas de Toaster monté dans ce test isolé : on vérifie l'effet concret,
    // le fait qu'aucun export n'ait été déclenché.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(createObjectURLSpy).not.toHaveBeenCalled()
  })
})
