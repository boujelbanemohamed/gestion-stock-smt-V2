"use client"

import type React from "react"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères")
      return
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Erreur lors de la réinitialisation")
        setIsLoading(false)
        return
      }

      setSuccess(true)
      setIsLoading(false)
    } catch (error) {
      console.error('Reset password error:', error)
      setError("Erreur de connexion au serveur")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-900">Nouveau mot de passe</CardTitle>
          <CardDescription className="text-slate-600">
            {success ? "Votre mot de passe a été réinitialisé" : "Choisissez un nouveau mot de passe"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  Ce lien de réinitialisation est invalide. Veuillez en redemander un depuis la page de connexion.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link href="/login">Retour à la connexion</Link>
              </Button>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Votre mot de passe a bien été réinitialisé. Vous pouvez maintenant vous connecter.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link href="/login">Se connecter</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
