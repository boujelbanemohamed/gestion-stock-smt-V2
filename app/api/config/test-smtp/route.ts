import { type NextRequest, NextResponse } from "next/server"
import type { ApiResponse } from "@/lib/api-types"
import * as nodemailer from "nodemailer"
import { requireAdmin } from "@/lib/auth-middleware"

// POST /api/config/test-smtp - Tester la configuration SMTP

// Forcer la route à être dynamique (ne pas pré-rendre)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    const { smtp, testEmail } = body

    // Validation des paramètres requis
    if (!smtp || !smtp.host || !smtp.username || !smtp.password) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Configuration SMTP incomplète. Vérifiez l'hôte, le nom d'utilisateur et le mot de passe.",
        },
        { status: 400 },
      )
    }

    if (!testEmail) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Adresse email de test requise.",
        },
        { status: 400 },
      )
    }

    // Créer le transporteur SMTP
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.secure || false,
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    })

    // Vérifier la configuration SMTP
    await transporter.verify()

    // Préparer l'email de test
    const testEmailContent = {
      from: `"${smtp.fromName || 'Test SMTP'}" <${smtp.fromEmail || smtp.username}>`,
      to: testEmail,
      subject: "Test de configuration SMTP - Plateforme Gestion de Stocks",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">✅ Test de configuration SMTP réussi !</h2>
          
          <p>Bonjour,</p>
          
          <p>Cet email confirme que la configuration SMTP de votre plateforme de gestion de stocks fonctionne correctement.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">Détails de la configuration :</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Serveur SMTP :</strong> ${smtp.host}</li>
              <li><strong>Port :</strong> ${smtp.port || 587}</li>
              <li><strong>Connexion sécurisée :</strong> ${smtp.secure ? 'Oui (SSL/TLS)' : 'Non'}</li>
              <li><strong>Nom d'utilisateur :</strong> ${smtp.username}</li>
              <li><strong>Email d'envoi :</strong> ${smtp.fromEmail || smtp.username}</li>
              <li><strong>Nom de l'expéditeur :</strong> ${smtp.fromName || 'Plateforme Gestion de Stocks'}</li>
            </ul>
          </div>
          
          <p><strong>Date et heure du test :</strong> ${new Date().toLocaleString('fr-FR', { 
            timeZone: 'Africa/Tunis',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
          
          <p style="color: #059669; font-weight: bold;">
            🎉 Votre configuration SMTP est opérationnelle ! Vous pouvez maintenant envoyer des emails depuis votre plateforme.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #6b7280;">
            Cet email a été envoyé automatiquement depuis la plateforme de gestion de stocks.<br>
            Si vous n'avez pas demandé ce test, vous pouvez ignorer cet email.
          </p>
        </div>
      `,
      text: `
Test de configuration SMTP réussi !

Bonjour,

Cet email confirme que la configuration SMTP de votre plateforme de gestion de stocks fonctionne correctement.

Détails de la configuration :
- Serveur SMTP : ${smtp.host}
- Port : ${smtp.port || 587}
- Connexion sécurisée : ${smtp.secure ? 'Oui (SSL/TLS)' : 'Non'}
- Nom d'utilisateur : ${smtp.username}
- Email d'envoi : ${smtp.fromEmail || smtp.username}
- Nom de l'expéditeur : ${smtp.fromName || 'Plateforme Gestion de Stocks'}

Date et heure du test : ${new Date().toLocaleString('fr-FR', { 
  timeZone: 'Africa/Tunis',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

🎉 Votre configuration SMTP est opérationnelle ! Vous pouvez maintenant envoyer des emails depuis votre plateforme.

---
Cet email a été envoyé automatiquement depuis la plateforme de gestion de stocks.
Si vous n'avez pas demandé ce test, vous pouvez ignorer cet email.
      `,
    }

    // Envoyer l'email de test
    await transporter.sendMail(testEmailContent)

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: `Email de test envoyé avec succès à ${testEmail}`,
      },
    )
  } catch (error) {
    console.error('Error testing SMTP:', error)
    
    // Messages d'erreur plus spécifiques
    let errorMessage = "Erreur lors du test SMTP"
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase()
      const responseMsg = (error as any).response?.toLowerCase() || ''
      
      // Log d'erreur pour débogage en développement
      if (process.env.NODE_ENV === 'development') {
        console.log('SMTP Error debugging:', {
          message: error.message,
          response: (error as any).response,
          code: (error as any).code,
          fullErrorText: `${errorMsg} ${responseMsg}`
        })
      }
      
      if (errorMsg.includes('invalid login') || (error as any).code === 'EAUTH') {
        // Vérifier spécifiquement pour l'erreur Gmail "Application-specific password required"
        const fullErrorText = `${errorMsg} ${responseMsg}`.toLowerCase()
        const errorResponse = (error as any).response || ''
        
        // Détection spécifique pour Gmail
        if (errorResponse.includes('Application-specific password required') ||
            errorResponse.includes('534-5.7.9') ||
            fullErrorText.includes('application-specific password required') ||
            errorResponse.includes('application-specific password') ||
            errorResponse.includes('534') ||
            errorResponse.includes('5.7.9') ||
            errorResponse.includes('gsmtp')) {
          errorMessage = "Gmail nécessite un mot de passe d'application. Activez l'authentification à 2 facteurs et générez un mot de passe d'application dans les paramètres de sécurité de votre compte Google."
        } else if (fullErrorText.includes('less secure app access') || 
                   errorResponse.includes('less secure app access')) {
          errorMessage = "Accès aux applications moins sécurisées désactivé. Activez cette option dans les paramètres de sécurité de votre compte Google ou utilisez un mot de passe d'application."
        } else {
          errorMessage = "Identifiants SMTP invalides. Vérifiez le nom d'utilisateur et le mot de passe."
        }
      } else if (errorMsg.includes('econnrefused')) {
        errorMessage = "Impossible de se connecter au serveur SMTP. Vérifiez l'hôte et le port."
      } else if (errorMsg.includes('enotfound')) {
        errorMessage = "Serveur SMTP introuvable. Vérifiez l'adresse de l'hôte."
      } else if (errorMsg.includes('etimedout')) {
        errorMessage = "Délai de connexion dépassé. Vérifiez l'hôte et le port."
      } else if (errorMsg.includes('self signed certificate')) {
        errorMessage = "Certificat SSL auto-signé détecté. Activez l'option 'Connexion sécurisée' ou utilisez un port non sécurisé."
      } else {
        // Log l'erreur complète pour débogage
        console.log('SMTP Error details:', {
          message: error.message,
          response: (error as any).response,
          code: (error as any).code
        })
        errorMessage = `Erreur SMTP : ${error.message}`
      }
    }

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}
