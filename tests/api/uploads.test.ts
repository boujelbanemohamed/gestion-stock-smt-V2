// @vitest-environment node
//
// L'environnement par défaut de ce projet est jsdom, dont les globals File/FormData
// sont des implémentations DOM distinctes de celles (undici) qu'utilise next/server
// pour parser un corps multipart via request.formData(). Avec jsdom, le fichier
// envoyé n'est jamais retrouvé côté route (échec silencieux, "Aucun fichier fourni"
// même quand un fichier est bien fourni) : on bascule donc ce fichier sur l'environnement
// node pour que FormData/File soient les mêmes objets des deux côtés.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email-service", () => ({
  sendUserActivityAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", () => {
  const mkdir = vi.fn().mockResolvedValue(undefined)
  const writeFile = vi.fn().mockResolvedValue(undefined)
  return { mkdir, writeFile, default: { mkdir, writeFile } }
})

const { prisma } = await import("@/lib/db")
const { mkdir, writeFile } = await import("fs/promises")
const { POST: uploadAvatar, DELETE: deleteAvatar } = await import("@/app/api/users/[id]/avatar/route")
const { POST: uploadMovementDocument } = await import("@/app/api/movements/upload/route")

const selfToken = signAccessToken({
  userId: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
})

const otherUserToken = signAccessToken({
  userId: "user-2",
  email: "other@example.com",
  firstName: "Other",
  lastName: "User",
  role: "user",
})

function makeFile(name: string, type: string, sizeBytes: number) {
  const buffer = new Uint8Array(sizeBytes)
  return new File([buffer], name, { type })
}

function formDataRequest(url: string, file: File | null, token: string | null) {
  const formData = new FormData()
  if (file) formData.set("file", file)
  const headers = new Headers()
  if (token) headers.set("authorization", `Bearer ${token}`)
  return new NextRequest(url, { method: "POST", headers, body: formData as any })
}

const targetUser = {
  id: "user-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  isActive: true,
  avatarUrl: null,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  twoFactorBackupCodes: [],
}

describe("POST /api/users/[id]/avatar", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse qu'un utilisateur modifie l'avatar d'un tiers (403)", async () => {
    const response = await uploadAvatar(
      formDataRequest("http://localhost/api/users/user-1/avatar", makeFile("a.png", "image/png", 100), otherUserToken),
      { params: { id: "user-1" } },
    )
    expect(response.status).toBe(403)
  })

  it("refuse sans fichier (400)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser as any)
    const response = await uploadAvatar(
      formDataRequest("http://localhost/api/users/user-1/avatar", null, selfToken),
      { params: { id: "user-1" } },
    )
    expect(response.status).toBe(400)
  })

  it("refuse un fichier trop volumineux (400)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser as any)
    const response = await uploadAvatar(
      formDataRequest("http://localhost/api/users/user-1/avatar", makeFile("a.png", "image/png", 3 * 1024 * 1024), selfToken),
      { params: { id: "user-1" } },
    )
    expect(response.status).toBe(400)
  })

  it("refuse un type de fichier non autorisé (400)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser as any)
    const response = await uploadAvatar(
      formDataRequest("http://localhost/api/users/user-1/avatar", makeFile("a.gif", "image/gif", 100), selfToken),
      { params: { id: "user-1" } },
    )
    expect(response.status).toBe(400)
  })

  it("accepte un PNG valide, l'écrit sur disque et met à jour l'utilisateur", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser as any)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...targetUser, avatarUrl: "/uploads/avatars/x.png" } as any)

    const response = await uploadAvatar(
      formDataRequest("http://localhost/api/users/user-1/avatar", makeFile("a.png", "image/png", 100), selfToken),
      { params: { id: "user-1" } },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.avatarUrl).toMatch(/^\/uploads\/avatars\//)
    expect(mkdir).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalled()
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })
})

describe("DELETE /api/users/[id]/avatar", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse qu'un utilisateur retire l'avatar d'un tiers (403)", async () => {
    const response = await deleteAvatar(
      new NextRequest("http://localhost/api/users/user-1/avatar", {
        method: "DELETE",
        headers: new Headers({ authorization: `Bearer ${otherUserToken}` }),
      }),
      { params: { id: "user-1" } },
    )
    expect(response.status).toBe(403)
  })

  it("retire l'avatar de son propre compte", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ ...targetUser, avatarUrl: null } as any)
    const response = await deleteAvatar(
      new NextRequest("http://localhost/api/users/user-1/avatar", {
        method: "DELETE",
        headers: new Headers({ authorization: `Bearer ${selfToken}` }),
      }),
      { params: { id: "user-1" } },
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.avatarUrl).toBeNull()
  })
})

describe("POST /api/movements/upload", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse une requête non authentifiée (401)", async () => {
    const response = await uploadMovementDocument(
      formDataRequest("http://localhost/api/movements/upload", makeFile("doc.pdf", "application/pdf", 100), null),
    )
    expect(response.status).toBe(401)
  })

  it("refuse un type de fichier non autorisé (400)", async () => {
    const response = await uploadMovementDocument(
      formDataRequest("http://localhost/api/movements/upload", makeFile("doc.exe", "application/x-msdownload", 100), selfToken),
    )
    expect(response.status).toBe(400)
  })

  it("accepte un PDF valide et renvoie son URL", async () => {
    const response = await uploadMovementDocument(
      formDataRequest("http://localhost/api/movements/upload", makeFile("doc.pdf", "application/pdf", 100), selfToken),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.url).toMatch(/^\/uploads\/movements\//)
    expect(json.data.name).toBe("doc.pdf")
  })
})
