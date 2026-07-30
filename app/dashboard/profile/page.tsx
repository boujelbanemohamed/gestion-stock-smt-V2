"use client"

import type React from "react"
import { useState, useEffect } from "react"
import type { User } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "@/hooks/use-toast"
import { authenticatedFetch } from "@/lib/api-client"
import { eventBus } from "@/lib/event-bus"

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  // Double authentification (2FA)
  const [twoFactorStep, setTwoFactorStep] = useState<"idle" | "qr" | "backupCodes">("idle")
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [manualSecret, setManualSecret] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [isTwoFactorLoading, setIsTwoFactorLoading] = useState(false)
  const [isDisablingTwoFactor, setIsDisablingTwoFactor] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [isTwoFactorFeatureEnabled, setIsTwoFactorFeatureEnabled] = useState(false)

  useEffect(() => {
    // Récupérer l'utilisateur depuis localStorage
    const storedUser = localStorage.getItem('currentUser')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setCurrentUser(user)
        setFormData({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || "",
        })
      } catch (error) {
        console.error('Error parsing stored user:', error)
        localStorage.removeItem('currentUser')
      }
    }

    // Vérifie si la double authentification est activée globalement (Configuration > Sécurité).
    authenticatedFetch('/api/config')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setIsTwoFactorFeatureEnabled(Boolean(data.data?.security?.twoFactor?.enabled))
        }
      })
      .catch((error) => console.error('Error loading 2FA availability:', error))
  }, [])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !currentUser) return

    setIsUploadingAvatar(true)
    try {
      const body = new FormData()
      body.append("file", file)

      const response = await authenticatedFetch(`/api/users/${currentUser.id}/avatar`, {
        method: 'POST',
        body,
      })
      const data = await response.json()

      if (data.success) {
        const updatedUser = { ...currentUser, avatarUrl: data.data.avatarUrl }
        localStorage.setItem('currentUser', JSON.stringify(updatedUser))
        setCurrentUser(updatedUser)
        eventBus.emit("user:updated", updatedUser)
        toast({ title: "Avatar mis à jour", description: "Votre photo de profil a été mise à jour avec succès.", variant: "success" })
      } else {
        toast({ title: "Téléversement impossible", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: "Téléversement impossible",
        description: "Une erreur est survenue pendant l'envoi de votre photo.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!currentUser) return

    setIsUploadingAvatar(true)
    try {
      const response = await authenticatedFetch(`/api/users/${currentUser.id}/avatar`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        const updatedUser = { ...currentUser, avatarUrl: null }
        localStorage.setItem('currentUser', JSON.stringify(updatedUser))
        setCurrentUser(updatedUser)
        eventBus.emit("user:updated", updatedUser)
        toast({ title: "Avatar supprimé", description: "Votre photo de profil a été retirée.", variant: "success" })
      } else {
        toast({ title: "Suppression impossible", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      console.error('Error removing avatar:', error)
      toast({
        title: "Suppression impossible",
        description: "Une erreur est survenue pendant la suppression de votre photo.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!currentUser) return

    try {
      const response = await authenticatedFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const updatedUser = { ...currentUser, ...formData }
        localStorage.setItem('currentUser', JSON.stringify(updatedUser))
        setCurrentUser(updatedUser)
        eventBus.emit("user:updated", updatedUser)
        setIsEditing(false)
        toast({
          title: "Profil mis à jour",
          description: "Vos informations ont été sauvegardées avec succès.",
          variant: "success",
        })
      } else {
        toast({
          title: "Mise à jour impossible",
          description: "Vos informations n'ont pas pu être enregistrées.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: "Mise à jour impossible",
        description: "Une erreur est survenue pendant la mise à jour du profil.",
        variant: "destructive",
      })
    }
  }

  const handleChangePassword = async () => {
    if (!currentUser) return

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Mots de passe différents",
        description: "La confirmation ne correspond pas au nouveau mot de passe.",
        variant: "destructive",
      })
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await authenticatedFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: passwordData.newPassword })
      })

      if (response.ok) {
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })
        setIsChangingPassword(false)
        toast({
          title: "Mot de passe modifié",
          description: "Votre mot de passe a été mis à jour avec succès.",
          variant: "success",
        })
      } else {
        toast({
          title: "Modification impossible",
          description: "Le mot de passe n'a pas pu être modifié.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error changing password:', error)
      toast({
        title: "Modification impossible",
        description: "Une erreur est survenue pendant le changement de mot de passe.",
        variant: "destructive",
      })
    }
  }

  const handleStartTwoFactorSetup = async () => {
    setIsTwoFactorLoading(true)
    try {
      const response = await authenticatedFetch("/api/auth/2fa/setup", { method: "POST" })
      const data = await response.json()

      if (data.success) {
        setQrCodeDataUrl(data.data.qrCodeDataUrl)
        setManualSecret(data.data.secret)
        setTwoFactorStep("qr")
      } else {
        toast({ title: "Activation impossible", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      console.error('Error starting 2FA setup:', error)
      toast({
        title: "Activation impossible",
        description: "La double authentification n'a pas pu être préparée.",
        variant: "destructive",
      })
    } finally {
      setIsTwoFactorLoading(false)
    }
  }

  const handleConfirmTwoFactor = async () => {
    if (!currentUser) return

    setIsTwoFactorLoading(true)
    try {
      const response = await authenticatedFetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      })
      const data = await response.json()

      if (data.success) {
        setBackupCodes(data.data.backupCodes)
        setTwoFactorStep("backupCodes")
        setVerificationCode("")

        const updatedUser = { ...currentUser, twoFactorEnabled: true }
        localStorage.setItem('currentUser', JSON.stringify(updatedUser))
        setCurrentUser(updatedUser)
        eventBus.emit("user:updated", updatedUser)
        toast({
          title: "Double authentification activée",
          description: "Conservez vos codes de secours dans un endroit sûr.",
          variant: "success",
        })
      } else {
        toast({
          title: "Code incorrect",
          description: data.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error enabling 2FA:', error)
      toast({
        title: "Activation impossible",
        description: "La double authentification n'a pas pu être activée.",
        variant: "destructive",
      })
    } finally {
      setIsTwoFactorLoading(false)
    }
  }

  const handleCancelTwoFactorSetup = () => {
    setTwoFactorStep("idle")
    setQrCodeDataUrl("")
    setManualSecret("")
    setVerificationCode("")
  }

  const handleFinishTwoFactorSetup = () => {
    setTwoFactorStep("idle")
    setQrCodeDataUrl("")
    setManualSecret("")
    setBackupCodes([])
  }

  const handleDisableTwoFactor = async () => {
    if (!currentUser) return

    setIsTwoFactorLoading(true)
    try {
      const response = await authenticatedFetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      })
      const data = await response.json()

      if (data.success) {
        const updatedUser = { ...currentUser, twoFactorEnabled: false }
        localStorage.setItem('currentUser', JSON.stringify(updatedUser))
        setCurrentUser(updatedUser)
        eventBus.emit("user:updated", updatedUser)
        setIsDisablingTwoFactor(false)
        setDisablePassword("")
        toast({ title: "Double authentification désactivée", variant: "success" })
      } else {
        toast({
          title: "Désactivation impossible",
          description: data.error || "Mot de passe incorrect.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error disabling 2FA:', error)
      toast({
        title: "Désactivation impossible",
        description: "La double authentification n'a pas pu être désactivée.",
        variant: "destructive",
      })
    } finally {
      setIsTwoFactorLoading(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle>Photo de profil</CardTitle>
          <CardDescription>Ajoutez une photo pour personnaliser votre compte.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={currentUser.avatarUrl || undefined} alt={`${currentUser.firstName} ${currentUser.lastName}`} />
            <AvatarFallback className="text-xl">
              {currentUser.firstName?.[0] || ""}
              {currentUser.lastName?.[0] || ""}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button asChild size="sm" disabled={isUploadingAvatar}>
                <label htmlFor="avatar-upload" className="cursor-pointer">
                  {isUploadingAvatar ? "Envoi en cours..." : "Changer la photo"}
                </label>
              </Button>
              {currentUser.avatarUrl && (
                <Button size="sm" variant="outline" onClick={handleRemoveAvatar} disabled={isUploadingAvatar}>
                  Retirer
                </Button>
              )}
            </div>
            <input
              id="avatar-upload"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={isUploadingAvatar}
            />
            <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP, 2 Mo maximum.</p>
          </div>
        </CardContent>
      </Card>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du profil</CardTitle>
          <CardDescription>Gérez vos informations personnelles et vos préférences de compte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isEditing}
                placeholder="Numéro de téléphone"
              />
            </div>
          </div>

          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <Button onClick={handleSaveProfile}>Sauvegarder</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Modifier</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle>Changer le mot de passe</CardTitle>
          <CardDescription>Mettez à jour votre mot de passe pour sécuriser votre compte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isChangingPassword ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleChangePassword}>Changer le mot de passe</Button>
                <Button variant="outline" onClick={() => setIsChangingPassword(false)}>
                  Annuler
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={() => setIsChangingPassword(true)}>Changer le mot de passe</Button>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Double authentification (2FA) : masquée si désactivée globalement dans
          Configuration > Sécurité, sauf pour un utilisateur qui l'a déjà activée
          (il doit toujours pouvoir la désactiver lui-même). */}
      {(isTwoFactorFeatureEnabled || currentUser.twoFactorEnabled) && (
      <Card>
        <CardHeader>
          <CardTitle>Double authentification (2FA)</CardTitle>
          <CardDescription>
            Ajoutez une couche de sécurité supplémentaire à votre compte avec une application d'authentification
            (Google Authenticator, Microsoft Authenticator, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {twoFactorStep === "idle" &&
            (currentUser.twoFactorEnabled ? (
              <>
                <p className="text-sm font-medium text-green-600">Activée</p>
                {!isDisablingTwoFactor ? (
                  <Button variant="destructive" onClick={() => setIsDisablingTwoFactor(true)}>
                    Désactiver
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="disablePassword">Confirmez votre mot de passe pour désactiver</Label>
                    <Input
                      id="disablePassword"
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                    />
                    <div className="flex space-x-2">
                      <Button variant="destructive" onClick={handleDisableTwoFactor} disabled={isTwoFactorLoading}>
                        {isTwoFactorLoading ? "Désactivation..." : "Confirmer la désactivation"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsDisablingTwoFactor(false)
                          setDisablePassword("")
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Non activée</p>
                <Button onClick={handleStartTwoFactorSetup} disabled={isTwoFactorLoading}>
                  {isTwoFactorLoading ? "Préparation..." : "Activer la double authentification"}
                </Button>
              </>
            ))}

          {twoFactorStep === "qr" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scannez ce QR code avec votre application d'authentification, puis saisissez le code généré pour
                confirmer.
              </p>
              {qrCodeDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCodeDataUrl} alt="QR code de double authentification" className="h-48 w-48" />
              )}
              <div className="space-y-1">
                <Label>Clé manuelle (si vous ne pouvez pas scanner le QR code)</Label>
                <code className="block break-all rounded bg-muted p-2 text-xs">{manualSecret}</code>
              </div>
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Code de vérification</Label>
                <Input
                  id="verificationCode"
                  inputMode="numeric"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleConfirmTwoFactor} disabled={isTwoFactorLoading}>
                  {isTwoFactorLoading ? "Vérification..." : "Confirmer et activer"}
                </Button>
                <Button variant="outline" onClick={handleCancelTwoFactorSetup}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {twoFactorStep === "backupCodes" && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-destructive">
                Notez ces codes de secours dans un endroit sûr : ils ne seront plus jamais affichés. Chacun ne peut
                être utilisé qu'une seule fois, pour vous connecter si vous perdez l'accès à votre application
                d'authentification.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded bg-muted p-4 font-mono text-sm">
                {backupCodes.map((code) => (
                  <div key={code}>{code}</div>
                ))}
              </div>
              <Button onClick={handleFinishTwoFactorSetup}>J'ai noté mes codes</Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du compte</CardTitle>
          <CardDescription>Détails de votre compte et permissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Rôle:</span>
              <span className="capitalize">{currentUser.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Statut:</span>
              <span className={currentUser.isActive ? "text-green-600" : "text-red-600"}>
                {currentUser.isActive ? "Actif" : "Inactif"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Dernière connexion:</span>
              <span>{currentUser.lastLogin ? new Date(currentUser.lastLogin).toLocaleDateString("fr-FR") : "Jamais"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
