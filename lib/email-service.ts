// Ce module ne doit s'exécuter que côté serveur
import "server-only"

import * as nodemailer from "nodemailer"
import { prisma } from "@/lib/db"
import { getServerApiUrl } from "@/lib/env"
import { normalizeNotificationSettings } from "@/lib/notification-settings"
import type { AccountEmailSettings, NotificationChannelToggle } from "@/lib/types"

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  fromEmail: string
  fromName: string
}

interface NotificationConfig {
  emailNotifications: boolean
  emailRecipients: string[]
  lowStockAlerts: NotificationChannelToggle
  movementNotifications: NotificationChannelToggle
  userActivityAlerts: NotificationChannelToggle
  accountEmails: AccountEmailSettings
  criticalStockThreshold?: number
}

/**
 * Récupère la configuration SMTP depuis la base de données
 */
async function getEmailConfig(): Promise<EmailConfig | null> {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { id: "singleton" },
    })

    if (!config || !config.config) return null

    const configData = config.config as any
    const smtp = configData?.smtp

    if (!smtp || !smtp.host || !smtp.username || !smtp.password) {
      return null
    }

    return {
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.secure || false,
      username: smtp.username,
      password: smtp.password,
      fromEmail: smtp.fromEmail || smtp.username,
      fromName: smtp.fromName || "Plateforme Gestion de Stocks",
    }
  } catch (error) {
    console.error("Error fetching email config:", error)
    return null
  }
}

/**
 * Récupère la configuration des notifications depuis la base de données
 */
async function getNotificationConfig(): Promise<NotificationConfig | null> {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { id: "singleton" },
    })

    if (!config || !config.config) return null

    const configData = config.config as any
    const notifications = normalizeNotificationSettings(configData?.notifications)

    return {
      emailNotifications: notifications.emailNotifications,
      emailRecipients: notifications.emailRecipients,
      lowStockAlerts: notifications.lowStockAlerts,
      movementNotifications: notifications.movementNotifications,
      userActivityAlerts: notifications.userActivityAlerts,
      accountEmails: notifications.accountEmails,
      criticalStockThreshold: notifications.criticalStockThreshold,
    }
  } catch (error) {
    console.error("Error fetching notification config:", error)
    return null
  }
}

/**
 * Crée un transporteur email
 */
async function createTransporter() {
  const emailConfig = await getEmailConfig()
  if (!emailConfig) {
    throw new Error("Configuration SMTP non trouvée")
  }

  return nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
      user: emailConfig.username,
      pass: emailConfig.password,
    },
  })
}

/**
 * Envoie un email
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  try {
    const emailConfig = await getEmailConfig()
    if (!emailConfig) {
      console.warn("Configuration SMTP non disponible, email non envoyé")
      return false
    }

    const transporter = await createTransporter()
    const recipients = Array.isArray(to) ? to.join(", ") : to

    await transporter.sendMail({
      from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
      to: recipients,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Version texte sans HTML
    })

    console.log(`Email envoyé avec succès à: ${recipients}`)
    return true
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email:", error)
    return false
  }
}

/**
 * Récupère la liste des destinataires des notifications
 */
async function getNotificationRecipients(): Promise<string[]> {
  const config = await getNotificationConfig()
  return config?.emailRecipients || []
}

/**
 * Envoie un email de bienvenue à un nouvel utilisateur
 */
export async function sendUserWelcomeEmail(
  email: string,
  firstName: string,
  lastName: string,
  password: string,
  role: string
): Promise<boolean> {
  const config = await getNotificationConfig()
  if (!config?.emailNotifications || !config?.accountEmails.welcomeEmail) {
    console.log("Email de bienvenue désactivé, email non envoyé")
    return false
  }

  const subject = "Informations de connexion - Plateforme Gestion de Stocks"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">Bienvenue sur la Plateforme de Gestion de Stocks</h2>
      
      <p>Bonjour ${firstName} ${lastName},</p>
      
      <p>Votre compte a été créé avec succès sur la plateforme de gestion de stocks de la Société Monétique Tunisie.</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <h3 style="color: #1e40af; margin-top: 0;">Vos informations de connexion :</h3>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;"><strong>Email :</strong> ${email}</li>
          <li style="margin: 10px 0;"><strong>Mot de passe temporaire :</strong> <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></li>
          <li style="margin: 10px 0;"><strong>Rôle :</strong> ${role}</li>
        </ul>
      </div>
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          <strong>⚠️ Important :</strong> Veuillez vous connecter et changer votre mot de passe dès que possible pour des raisons de sécurité.
        </p>
      </div>
      
      <p style="margin-top: 30px;">
        <a href="${getServerApiUrl()}/dashboard" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Accéder à la plateforme
        </a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="font-size: 12px; color: #6b7280;">
        Cet email a été envoyé automatiquement par la plateforme de gestion de stocks.<br>
        Si vous n'avez pas demandé ce compte, veuillez contacter l'administrateur.
      </p>
      
      <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">
        Société Monétique Tunisie<br>
        Centre urbain Nord, Sana Center, bloc C – 1082, Tunis
      </p>
    </div>
  `

  return sendEmail(email, subject, html)
}

/**
 * Envoie l'email de réinitialisation de mot de passe ("mot de passe oublié").
 * Contrôlé par son propre interrupteur (accountEmails.passwordResetEmail),
 * mais jamais par l'interrupteur général "notifications email activées" :
 * le désactiver ne doit pas couper silencieusement toute autre notif email.
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  resetUrl: string
): Promise<boolean> {
  const config = await getNotificationConfig()
  if (!config?.accountEmails.passwordResetEmail) {
    return false
  }

  const subject = "Réinitialisation de votre mot de passe - Plateforme Gestion de Stocks"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">Réinitialisation de mot de passe</h2>

      <p>Bonjour ${firstName},</p>

      <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte sur la plateforme de gestion de stocks.</p>

      <p style="margin: 30px 0;">
        <a href="${resetUrl}"
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Réinitialiser mon mot de passe
        </a>
      </p>

      <p style="font-size: 13px; color: #6b7280;">
        Ce lien est valable 30 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email : votre mot de passe restera inchangé.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <p style="font-size: 12px; color: #6b7280;">
        Cet email a été envoyé automatiquement par la plateforme de gestion de stocks.
      </p>

      <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">
        Société Monétique Tunisie<br>
        Centre urbain Nord, Sana Center, bloc C – 1082, Tunis
      </p>
    </div>
  `

  return sendEmail(email, subject, html)
}

/**
 * Confirme par email qu'un mot de passe vient d'être changé (réinitialisation
 * "mot de passe oublié", changement volontaire par l'utilisateur, ou
 * réinitialisation par un administrateur). Permet à l'utilisateur de réagir
 * rapidement si ce changement n'est pas de son fait. Contrôlé par son propre
 * interrupteur (accountEmails.passwordChangedEmail), jamais par l'interrupteur
 * général "notifications email activées".
 */
export async function sendPasswordChangedConfirmationEmail(
  email: string,
  firstName: string
): Promise<boolean> {
  const config = await getNotificationConfig()
  if (!config?.accountEmails.passwordChangedEmail) {
    return false
  }

  const subject = "Votre mot de passe a été modifié - Plateforme Gestion de Stocks"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #059669;">Mot de passe modifié</h2>

      <p>Bonjour ${firstName},</p>

      <p>Le mot de passe de votre compte sur la plateforme de gestion de stocks vient d'être modifié avec succès.</p>

      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
        <p style="margin: 0;"><strong>Date :</strong> ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Tunis" })}</p>
      </div>

      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          <strong>⚠️ Vous n'êtes pas à l'origine de ce changement ?</strong> Contactez immédiatement votre administrateur.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <p style="font-size: 12px; color: #6b7280;">
        Cet email a été envoyé automatiquement par la plateforme de gestion de stocks.
      </p>

      <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">
        Société Monétique Tunisie<br>
        Centre urbain Nord, Sana Center, bloc C – 1082, Tunis
      </p>
    </div>
  `

  return sendEmail(email, subject, html)
}

/**
 * Confirme par email un changement de méthode d'authentification (activation
 * ou désactivation de la double authentification), qu'il soit à l'initiative
 * de l'utilisateur ou d'un administrateur. Contrôlé par son propre
 * interrupteur (accountEmails.authMethodChangedEmail), jamais par
 * l'interrupteur général "notifications email activées".
 */
export async function sendAuthMethodChangedEmail(
  email: string,
  firstName: string,
  newMethod: "password" | "2fa"
): Promise<boolean> {
  const config = await getNotificationConfig()
  if (!config?.accountEmails.authMethodChangedEmail) {
    return false
  }

  const subject = "Votre méthode d'authentification a changé - Plateforme Gestion de Stocks"
  const methodLabel = newMethod === "2fa" ? "Mot de passe + double authentification (2FA)" : "Mot de passe seul"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">Méthode d'authentification modifiée</h2>

      <p>Bonjour ${firstName},</p>

      <p>La méthode d'authentification de votre compte sur la plateforme de gestion de stocks vient d'être modifiée.</p>

      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 0;"><strong>Nouvelle méthode :</strong> ${methodLabel}</p>
        <p style="margin: 10px 0 0;"><strong>Date :</strong> ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Tunis" })}</p>
      </div>

      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          <strong>⚠️ Vous n'êtes pas à l'origine de ce changement ?</strong> Contactez immédiatement votre administrateur.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <p style="font-size: 12px; color: #6b7280;">
        Cet email a été envoyé automatiquement par la plateforme de gestion de stocks.
      </p>

      <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">
        Société Monétique Tunisie<br>
        Centre urbain Nord, Sana Center, bloc C – 1082, Tunis
      </p>
    </div>
  `

  return sendEmail(email, subject, html)
}

/**
 * Envoie une alerte de stock faible
 */
export async function sendLowStockAlert(
  cardName: string,
  currentStock: number,
  minThreshold: number,
  location?: string,
  bank?: string
): Promise<boolean> {
  const config = await getNotificationConfig()
  if (!config?.emailNotifications || !config?.lowStockAlerts.email) {
    return false
  }

  const recipients = await getNotificationRecipients()
  if (recipients.length === 0) {
    console.log("Aucun destinataire configuré pour les alertes de stock")
    return false
  }

  const criticalThreshold = config?.criticalStockThreshold || 50
  const isCritical = currentStock < criticalThreshold
  const alertLevel = isCritical ? "CRITIQUE" : "FAIBLE"
  const color = isCritical ? "#dc2626" : "#f59e0b"

  const subject = `🚨 Alerte Stock ${alertLevel} - ${cardName}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: ${color}; border-bottom: 3px solid ${color}; padding-bottom: 10px;">
        Alerte Stock ${alertLevel}
      </h2>
      
      <p>Bonjour,</p>
      
      <p>Une alerte de stock a été détectée pour la carte suivante :</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
        <h3 style="color: #1e40af; margin-top: 0;">Détails de l'alerte :</h3>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;"><strong>Carte :</strong> ${cardName}</li>
          ${location ? `<li style="margin: 10px 0;"><strong>Emplacement :</strong> ${location}</li>` : ""}
          ${bank ? `<li style="margin: 10px 0;"><strong>Banque :</strong> ${bank}</li>` : ""}
          <li style="margin: 10px 0;"><strong>Stock actuel :</strong> <span style="color: ${color}; font-weight: bold; font-size: 18px;">${currentStock}</span></li>
          <li style="margin: 10px 0;"><strong>Seuil minimum :</strong> ${minThreshold}</li>
          <li style="margin: 10px 0;"><strong>Déficit :</strong> <span style="color: ${color}; font-weight: bold;">${minThreshold - currentStock} unités</span></li>
        </ul>
      </div>
      
      <div style="background-color: ${isCritical ? "#fee2e2" : "#fef3c7"}; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
        <p style="margin: 0; color: ${isCritical ? "#991b1b" : "#92400e"};">
          <strong>${isCritical ? "⚠️ URGENT" : "⚠️ Attention"} :</strong> 
          ${isCritical ? "Le stock est critique ! Une réapprovisionnement immédiat est nécessaire." : "Le stock est en dessous du seuil minimum. Veuillez prévoir une réapprovisionnement."}
        </p>
      </div>
      
      <p style="margin-top: 30px;">
        <a href="${getServerApiUrl()}/dashboard/cards" 
           style="background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Voir les cartes
        </a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="font-size: 12px; color: #6b7280;">
        Cette notification a été envoyée automatiquement par la plateforme de gestion de stocks.
      </p>
    </div>
  `

  return sendEmail(recipients, subject, html)
}

/**
 * Envoie une notification de mouvement de stock
 */
export async function sendMovementNotification(
  movementType: "entry" | "exit" | "transfer",
  cardName: string,
  quantity: number,
  fromLocation?: string,
  toLocation?: string,
  reason?: string
): Promise<boolean> {
  const config = await getNotificationConfig()
  if (!config?.emailNotifications || !config?.movementNotifications.email) {
    return false
  }

  const recipients = await getNotificationRecipients()
  if (recipients.length === 0) {
    return false
  }

  const typeLabels: Record<string, string> = {
    entry: "Entrée",
    exit: "Sortie",
    transfer: "Transfert",
  }

  const typeColors: Record<string, string> = {
    entry: "#10b981",
    exit: "#ef4444",
    transfer: "#3b82f6",
  }

  const label = typeLabels[movementType] || movementType
  const color = typeColors[movementType] || "#6b7280"

  const subject = `📦 Mouvement de Stock - ${label} de ${cardName}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: ${color}; border-bottom: 3px solid ${color}; padding-bottom: 10px;">
        Mouvement de Stock : ${label}
      </h2>
      
      <p>Bonjour,</p>
      
      <p>Un nouveau mouvement de stock a été enregistré :</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
        <h3 style="color: #1e40af; margin-top: 0;">Détails du mouvement :</h3>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;"><strong>Type :</strong> <span style="color: ${color}; font-weight: bold;">${label}</span></li>
          <li style="margin: 10px 0;"><strong>Carte :</strong> ${cardName}</li>
          <li style="margin: 10px 0;"><strong>Quantité :</strong> <span style="font-weight: bold; font-size: 18px;">${quantity}</span> unités</li>
          ${fromLocation ? `<li style="margin: 10px 0;"><strong>De :</strong> ${fromLocation}</li>` : ""}
          ${toLocation ? `<li style="margin: 10px 0;"><strong>Vers :</strong> ${toLocation}</li>` : ""}
          ${reason ? `<li style="margin: 10px 0;"><strong>Motif :</strong> ${reason}</li>` : ""}
          <li style="margin: 10px 0;"><strong>Date :</strong> ${new Date().toLocaleString("fr-FR")}</li>
        </ul>
      </div>
      
      <p style="margin-top: 30px;">
        <a href="${getServerApiUrl()}/dashboard/movements" 
           style="background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Voir les mouvements
        </a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="font-size: 12px; color: #6b7280;">
        Cette notification a été envoyée automatiquement par la plateforme de gestion de stocks.
      </p>
    </div>
  `

  return sendEmail(recipients, subject, html)
}

/**
 * Envoie une alerte d'activité utilisateur importante
 */
export async function sendUserActivityAlert(
  activityType: string,
  userName: string,
  userEmail: string,
  details: string
): Promise<boolean> {
  const config = await getNotificationConfig()
  if (!config?.emailNotifications || !config?.userActivityAlerts.email) {
    return false
  }

  const recipients = await getNotificationRecipients()
  if (recipients.length === 0) {
    return false
  }

  const subject = `👤 Activité Utilisateur - ${activityType}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #6366f1; border-bottom: 3px solid #6366f1; padding-bottom: 10px;">
        Activité Utilisateur
      </h2>
      
      <p>Bonjour,</p>
      
      <p>Une activité utilisateur importante a été détectée :</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
        <h3 style="color: #1e40af; margin-top: 0;">Détails de l'activité :</h3>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;"><strong>Type d'activité :</strong> ${activityType}</li>
          <li style="margin: 10px 0;"><strong>Utilisateur :</strong> ${userName}</li>
          <li style="margin: 10px 0;"><strong>Email :</strong> ${userEmail}</li>
          <li style="margin: 10px 0;"><strong>Détails :</strong> ${details}</li>
          <li style="margin: 10px 0;"><strong>Date :</strong> ${new Date().toLocaleString("fr-FR")}</li>
        </ul>
      </div>
      
      <p style="margin-top: 30px;">
        <a href="${getServerApiUrl()}/dashboard/logs" 
           style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Voir les logs
        </a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="font-size: 12px; color: #6b7280;">
        Cette notification a été envoyée automatiquement par la plateforme de gestion de stocks.
      </p>
    </div>
  `

  return sendEmail(recipients, subject, html)
}

