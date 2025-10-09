/**
 * Helper pour les appels API avec authentification
 * Ajoute automatiquement les headers nécessaires pour le logging
 */

export function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const userStr = localStorage.getItem('currentUser')
    if (!userStr) return {}

    const user = JSON.parse(userStr)
    return {
      'Content-Type': 'application/json',
      'x-user-data': JSON.stringify({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      })
    }
  } catch {
    return {
      'Content-Type': 'application/json'
    }
  }
}

/**
 * Wrapper pour fetch avec authentification automatique
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers
  }

  return fetch(url, {
    ...options,
    headers
  })
}

