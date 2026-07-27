"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { User } from "@/lib/types"
import { saveAuthTokens } from "@/lib/api-client"
import Image from "next/image"

interface LoginFormProps {
  onLogin: (user: User) => void
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Étape 2 (double authentification) : n'est utilisée que si le compte a la 2FA activée.
  // "twoFactorSetup" : un administrateur a rendu la 2FA obligatoire pour ce
  // compte, mais l'utilisateur n'a encore jamais configuré d'authenticator ;
  // il doit le faire immédiatement, avant tout accès au tableau de bord.
  // "forgotPassword" : demande de réinitialisation du mot de passe par email.
  const [step, setStep] = useState<"credentials" | "twoFactor" | "twoFactorSetup" | "forgotPassword">("credentials")
  const [tempToken, setTempToken] = useState("")
  const [code, setCode] = useState("")

  // Compte désactivé par un administrateur : message dédié, sans suggestion
  // de réinitialisation de mot de passe (ça ne débloquerait rien).
  const [accountDisabled, setAccountDisabled] = useState(false)

  // Verrouillage temporaire après trop de tentatives échouées (Configuration
  // > Sécurité) : compte à rebours affiché en direct, recalculé chaque
  // seconde à partir de l'horodatage de déverrouillage renvoyé par le serveur.
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const [resetEmail, setResetEmail] = useState("")
  const [isRequestingReset, setIsRequestingReset] = useState(false)
  const [resetRequested, setResetRequested] = useState(false)

  useEffect(() => {
    if (!lockedUntil) return

    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000))
      setRemainingSeconds(secondsLeft)
      if (secondsLeft <= 0) {
        setLockedUntil(null)
        setError("")
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  const formatCountdown = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const [setupSubStep, setSetupSubStep] = useState<"loading" | "qr" | "backupCodes">("loading")
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [manualSecret, setManualSecret] = useState("")
  const [setupCode, setSetupCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [pendingSession, setPendingSession] = useState<{ user: User; accessToken: string; refreshToken: string } | null>(null)

  const finalizeLogin = (user: User, accessToken: string, refreshToken: string) => {
    saveAuthTokens(accessToken, refreshToken, user)
    onLogin(user)
  }

  const startForcedTwoFactorSetup = async (token: string) => {
    setStep("twoFactorSetup")
    setSetupSubStep("loading")
    setError("")
    try {
      const response = await fetch('/api/auth/2fa/setup-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: token }),
      })
      const result = await response.json()

      if (!result.success || !result.data) {
        setError(result.error || "Erreur lors de la préparation de la double authentification")
        setStep("credentials")
        return
      }

      setQrCodeDataUrl(result.data.qrCodeDataUrl)
      setManualSecret(result.data.secret)
      setSetupSubStep("qr")
    } catch (error) {
      console.error('Forced 2FA setup error:', error)
      setError("Erreur de connexion au serveur")
      setStep("credentials")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setAccountDisabled(false)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const result = await response.json()

      if (result.data?.accountDisabled) {
        setAccountDisabled(true)
        setIsLoading(false)
        return
      }

      if (result.data?.locked) {
        setLockedUntil(new Date(result.data.lockedUntil))
        setError(result.error || "Compte temporairement verrouillé.")
        setIsLoading(false)
        return
      }

      if (!result.success || !result.data) {
        setError(result.error || "Email ou mot de passe incorrect")
        setIsLoading(false)
        return
      }

      if (result.data.requiresTwoFactorSetup) {
        // Mot de passe valide, mais la 2FA est obligatoire pour ce compte et
        // n'a encore jamais été configurée : on force la configuration maintenant.
        setTempToken(result.data.tempToken)
        setIsLoading(false)
        await startForcedTwoFactorSetup(result.data.tempToken)
        return
      }

      if (result.data.requiresTwoFactor) {
        // Mot de passe valide : il ne reste que le code de l'application d'authentification.
        setTempToken(result.data.tempToken)
        setStep("twoFactor")
        setIsLoading(false)
        return
      }

      const { user, accessToken, refreshToken } = result.data
      if (!user || !accessToken || !refreshToken) {
        setError("Erreur lors de la connexion : données incomplètes")
        setIsLoading(false)
        return
      }

      finalizeLogin(user, accessToken, refreshToken)
    } catch (error) {
      console.error('Login error:', error)
      setError("Erreur de connexion au serveur")
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code })
      })

      const result = await response.json()

      if (!result.success || !result.data) {
        setError(result.error || "Code de vérification incorrect")
        setIsLoading(false)
        return
      }

      const { user, accessToken, refreshToken } = result.data
      finalizeLogin(user, accessToken, refreshToken)
    } catch (error) {
      console.error('2FA verification error:', error)
      setError("Erreur de connexion au serveur")
      setIsLoading(false)
    }
  }

  const handleBackToCredentials = () => {
    setStep("credentials")
    setTempToken("")
    setCode("")
    setError("")
    // Le compte a pu être débloqué entre-temps (réinitialisation du mot de
    // passe) : on efface l'état de verrouillage local, le serveur le
    // réappliquera de toute façon si ce n'est pas réellement le cas.
    setLockedUntil(null)
    setAccountDisabled(false)
  }

  const handleOpenForgotPassword = () => {
    setStep("forgotPassword")
    setError("")
    setResetEmail(email)
    setResetRequested(false)
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsRequestingReset(true)
    setError("")

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      const result = await response.json()

      // Message générique affiché que le compte existe ou non (sécurité) :
      // on ne traite une erreur que si la requête elle-même a échoué.
      if (!result.success) {
        setError(result.error || "Erreur lors de la demande de réinitialisation")
        setIsRequestingReset(false)
        return
      }

      setResetRequested(true)
      setIsRequestingReset(false)
    } catch (error) {
      console.error('Forgot password error:', error)
      setError("Erreur de connexion au serveur")
      setIsRequestingReset(false)
    }
  }

  const handleConfirmForcedSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/2fa/enable-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code: setupCode }),
      })

      const result = await response.json()

      if (!result.success || !result.data) {
        setError(result.error || "Code de vérification incorrect")
        setIsLoading(false)
        return
      }

      const { user, accessToken, refreshToken, backupCodes: newBackupCodes } = result.data
      setPendingSession({ user, accessToken, refreshToken })
      setBackupCodes(newBackupCodes)
      setSetupSubStep("backupCodes")
      setIsLoading(false)
    } catch (error) {
      console.error('Forced 2FA enable error:', error)
      setError("Erreur de connexion au serveur")
      setIsLoading(false)
    }
  }

  const handleFinishForcedSetup = () => {
    if (!pendingSession) return
    finalizeLogin(pendingSession.user, pendingSession.accessToken, pendingSession.refreshToken)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <Image
              src="/images/monetique-logo.png"
              alt="Monétique Tunisie"
              width={180}
              height={60}
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Gestion de Stocks</CardTitle>
          <CardDescription className="text-slate-600">
            {step === "credentials" && "Connectez-vous à votre plateforme de gestion"}
            {step === "twoFactor" && "Saisissez le code de votre application d'authentification"}
            {step === "twoFactorSetup" &&
              (setupSubStep === "backupCodes"
                ? "Conservez vos codes de secours dans un endroit sûr"
                : "La double authentification est requise sur ce compte : configurez-la maintenant")}
            {step === "forgotPassword" &&
              (resetRequested ? "Vérifiez votre boîte de réception" : "Réinitialisez votre mot de passe")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "credentials" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full"
                />
              </div>
              {accountDisabled ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Votre compte est désactivé. Contactez l'administrateur.
                  </AlertDescription>
                </Alert>
              ) : lockedUntil && remainingSeconds > 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Compte temporairement verrouillé suite à plusieurs tentatives échouées. Réessayez dans{" "}
                    <strong>{formatCountdown(remainingSeconds)}</strong>, ou réinitialisez votre mot de passe.
                  </AlertDescription>
                </Alert>
              ) : (
                error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )
              )}
              <Button type="submit" className="w-full" disabled={isLoading || (!!lockedUntil && remainingSeconds > 0)}>
                {isLoading ? "Connexion..." : "Se connecter"}
              </Button>
              {!accountDisabled && (
                <button
                  type="button"
                  onClick={handleOpenForgotPassword}
                  className="w-full text-center text-sm text-blue-600 hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </form>
          ) : step === "twoFactor" ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">Code de vérification</Label>
                <Input
                  id="twoFactorCode"
                  inputMode="numeric"
                  autoFocus
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="w-full text-center text-lg tracking-widest"
                />
                <p className="text-xs text-slate-500">
                  Ou saisissez l'un de vos codes de secours si vous n'avez pas accès à l'application.
                </p>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Vérification..." : "Vérifier"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={handleBackToCredentials}>
                Retour
              </Button>
            </form>
          ) : step === "forgotPassword" ? (
            resetRequested ? (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Si un compte existe avec l'adresse <strong>{resetEmail}</strong>, un email contenant un lien de
                    réinitialisation vient de lui être envoyé. Pensez à vérifier vos spams.
                  </AlertDescription>
                </Alert>
                <Button type="button" variant="ghost" className="w-full" onClick={handleBackToCredentials}>
                  Retour à la connexion
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    autoFocus
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={isRequestingReset}>
                  {isRequestingReset ? "Envoi..." : "Envoyer le lien de réinitialisation"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={handleBackToCredentials}>
                  Retour à la connexion
                </Button>
              </form>
            )
          ) : setupSubStep === "loading" ? (
            <p className="text-center text-sm text-slate-500 py-8">Préparation de la double authentification...</p>
          ) : setupSubStep === "qr" ? (
            <form onSubmit={handleConfirmForcedSetup} className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                {qrCodeDataUrl && (
                  <img src={qrCodeDataUrl} alt="QR code de double authentification" className="h-48 w-48" />
                )}
                <p className="text-xs text-slate-500 text-center">
                  Scannez ce QR code avec Google Authenticator (ou une application compatible), ou saisissez
                  manuellement la clé :
                </p>
                <code className="text-xs bg-slate-100 rounded px-2 py-1 break-all">{manualSecret}</code>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setupCode">Code de vérification</Label>
                <Input
                  id="setupCode"
                  inputMode="numeric"
                  autoFocus
                  placeholder="123456"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  required
                  className="w-full text-center text-lg tracking-widest"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Vérification..." : "Activer et se connecter"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Ces codes de secours ne seront plus jamais affichés. Notez-les et conservez-les en lieu sûr.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((backupCode) => (
                  <code key={backupCode} className="text-sm bg-slate-100 rounded px-2 py-1 text-center">
                    {backupCode}
                  </code>
                ))}
              </div>
              <Button type="button" className="w-full" onClick={handleFinishForcedSetup}>
                J'ai noté mes codes, continuer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
