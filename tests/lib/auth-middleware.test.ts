import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth"
import { requireAuth, requireAdmin, isAdminRole } from "@/lib/auth-middleware"

function makeRequest(token?: string) {
  const headers = new Headers()
  if (token) headers.set("authorization", `Bearer ${token}`)
  return new NextRequest("http://localhost/api/test", { headers })
}

const userPayload = {
  userId: "user-1",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
}

const adminPayload = { ...userPayload, userId: "admin-1", email: "admin@example.com", role: "admin" }

describe("isAdminRole", () => {
  it("reconnaît les rôles administrateurs, insensible à la casse", () => {
    expect(isAdminRole("admin")).toBe(true)
    expect(isAdminRole("Admin")).toBe(true)
    expect(isAdminRole("super_admin")).toBe(true)
  })

  it("rejette les rôles non administrateurs", () => {
    expect(isAdminRole("user")).toBe(false)
    expect(isAdminRole("viewer")).toBe(false)
  })
})

describe("requireAuth", () => {
  it("refuse une requête sans token (401)", () => {
    const result = requireAuth(makeRequest())
    expect(result.authorized).toBe(false)
    if (!result.authorized) {
      expect(result.response.status).toBe(401)
    }
  })

  it("refuse une requête avec un token invalide (401)", () => {
    const result = requireAuth(makeRequest("token-invalide"))
    expect(result.authorized).toBe(false)
    if (!result.authorized) {
      expect(result.response.status).toBe(401)
    }
  })

  it("accepte une requête avec un token valide et expose l'utilisateur du token", () => {
    const token = signAccessToken(userPayload)
    const result = requireAuth(makeRequest(token))
    expect(result.authorized).toBe(true)
    if (result.authorized) {
      expect(result.user.id).toBe(userPayload.userId)
      expect(result.user.email).toBe(userPayload.email)
      expect(result.user.role).toBe(userPayload.role)
    }
  })
})

describe("requireAdmin", () => {
  it("refuse un utilisateur authentifié mais non-admin (403)", () => {
    const token = signAccessToken(userPayload)
    const result = requireAdmin(makeRequest(token))
    expect(result.authorized).toBe(false)
    if (!result.authorized) {
      expect(result.response.status).toBe(403)
    }
  })

  it("refuse une requête non authentifiée (401, pas 403)", () => {
    const result = requireAdmin(makeRequest())
    expect(result.authorized).toBe(false)
    if (!result.authorized) {
      expect(result.response.status).toBe(401)
    }
  })

  it("accepte un utilisateur admin", () => {
    const token = signAccessToken(adminPayload)
    const result = requireAdmin(makeRequest(token))
    expect(result.authorized).toBe(true)
    if (result.authorized) {
      expect(result.user.role).toBe("admin")
    }
  })
})
