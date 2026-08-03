/**
 * Helper pour les appels API avec authentification JWT
 * Gère automatiquement les tokens d'accès et leur rafraîchissement
 */

/**
 * Récupère le token d'accès depuis localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem('accessToken')
}

/**
 * Récupère le refresh token depuis localStorage
 */
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem('refreshToken')
}

/**
 * Rafraîchit le token d'accès en utilisant le refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return null
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      // Refresh token invalide : déconnecter l'utilisateur et le renvoyer vers
      // l'écran de connexion classique (route racine, comme logout()) — pas
      // "/login", qui n'existe pas dans cette application.
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('currentUser')
      window.location.href = '/'
      return null
    }

    const data = await response.json()
    if (data.success && data.data?.accessToken) {
      localStorage.setItem('accessToken', data.data.accessToken)
      return data.data.accessToken
    }

    return null
  } catch (error) {
    // Note: Logger non disponible ici car c'est côté client
    // Le logger est réservé au serveur
    if (process.env.NODE_ENV === 'development') {
      console.error('Error refreshing token:', error)
    }
    return null
  }
}

/**
 * Récupère les headers d'authentification avec le token JWT
 */
export function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') {
    return {}
  }

  const accessToken = getAccessToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  return headers as HeadersInit
}

/**
 * Wrapper pour fetch avec authentification automatique et rafraîchissement de token
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let accessToken = getAccessToken()

  // Pour un envoi de FormData (upload de fichier), le navigateur doit fixer
  // lui-même le Content-Type avec sa boundary multipart. On ne doit surtout
  // pas forcer 'Content-Type: application/json' par-dessus dans ce cas.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const baseHeaders = getAuthHeaders() as Record<string, string>
  if (isFormData) {
    delete baseHeaders['Content-Type']
  }

  let headers: Record<string, string> = {
    ...baseHeaders,
    ...(options.headers as Record<string, string> || {}),
  }

  // Première tentative
  let response = await fetch(url, {
    ...options,
    headers,
  })

  // Si le token a expiré (401), essayer de le rafraîchir
  if (response.status === 401 && accessToken) {
    const newAccessToken = await refreshAccessToken()
    
    if (newAccessToken) {
      // Réessayer la requête avec le nouveau token
      headers = {
        ...headers,
        'Authorization': `Bearer ${newAccessToken}`,
      }
      response = await fetch(url, {
        ...options,
        headers,
      })
    }
  }

  return response
}

/**
 * Sauvegarde les tokens après une connexion réussie
 */
export function saveAuthTokens(accessToken: string, refreshToken: string, user: any) {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem('accessToken', accessToken)
  localStorage.setItem('refreshToken', refreshToken)
  localStorage.setItem('currentUser', JSON.stringify(user))
}

/**
 * Supprime les tokens (déconnexion)
 */
export function clearAuthTokens() {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('currentUser')
}

/**
 * Vérifie si l'utilisateur est authentifié
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null
}

/**
 * Déconnexion complète : journalise la déconnexion côté serveur (best-effort,
 * ne bloque jamais la suite), puis supprime les jetons locaux et redirige.
 * Fonction unique appelée par le bouton « Déconnexion » et par la
 * déconnexion automatique pour inactivité — les deux doivent avoir
 * exactement le même effet.
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() })
  } catch {
    // La déconnexion locale doit réussir même si l'appel serveur échoue.
  }
  clearAuthTokens()
  window.location.href = '/'
}

