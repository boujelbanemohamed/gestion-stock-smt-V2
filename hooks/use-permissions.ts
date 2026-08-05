import { useState, useEffect, useRef, useCallback } from "react"
import type { User, Permission, Module, Action } from "@/lib/types"
import { authenticatedFetch, clearAuthTokens } from "@/lib/api-client"
import { eventBus } from "@/lib/event-bus"

interface UserPermissions {
  user: User | null
  permissions: Permission[]
  hasPermission: (module: Module, action: Action) => boolean
  hasAnyPermission: (module: Module, actions: Action[]) => boolean
  canAccessModule: (module: Module) => boolean
  isLoading: boolean
}

// Dernier recours si /api/roles est injoignable après tentative de
// rafraîchissement du token : les rôles sont en réalité configurables
// librement par un admin (table RolePermission, isCustom), donc aucune table
// figée par nom de rôle ne peut réellement les représenter. On se limite
// volontairement à des permissions de lecture de base plutôt que de deviner
// des droits par rôle (l'ancienne table incluait même "expedition", qui ne
// correspond à aucun rôle réellement initialisé).
const FALLBACK_PERMISSIONS: Permission[] = [
  'dashboard:view', 'banks:view', 'cards:view', 'locations:view', 'movements:view',
]

export function usePermissions(): UserPermissions {
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const hasLoaded = useRef(false)

  useEffect(() => {
    if (hasLoaded.current) return
    hasLoaded.current = true
    
    const loadUserAndPermissions = async () => {
      try {
        // Vérifier d'abord que le token est valide
        const accessToken = localStorage.getItem('accessToken')
        if (!accessToken) {
          clearAuthTokens()
          setUser(null)
          setPermissions([])
          setIsLoading(false)
          return
        }

        // Récupérer l'utilisateur depuis l'API pour vérifier que le token est valide
        try {
          console.log('[usePermissions] Vérification de l\'authentification via /api/auth/me...')
          const response = await authenticatedFetch('/api/auth/me')
          
          console.log(`[usePermissions] Réponse /api/auth/me - Status: ${response.status}`)
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error(`[usePermissions] ERREUR: Authentification échouée - Status: ${response.status}`)
            console.error(`[usePermissions] Détails de l'erreur:`, errorData)
            // Token invalide, nettoyer et arrêter
            clearAuthTokens()
            setUser(null)
            setPermissions([])
            setIsLoading(false)
            return
          }

          const data = await response.json()
          if (!data.success || !data.data) {
            clearAuthTokens()
            setUser(null)
            setPermissions([])
            setIsLoading(false)
            return
          }

          const userData = data.data as User

          // Vérifier que userData a les propriétés requises
          if (!userData || !userData.role || typeof userData.role !== 'string') {
            console.error('Invalid user data from API:', userData)
            clearAuthTokens()
            setUser(null)
            setPermissions([])
            setIsLoading(false)
            return
          }

          // Mettre à jour le localStorage avec les données fraîches
          localStorage.setItem('currentUser', JSON.stringify(userData))

          setUser(userData)

          // Si c'est un super_admin ou admin, donner toutes les permissions
        const roleLower = userData.role.toLowerCase()
        if (roleLower === 'super_admin' || roleLower === 'admin') {
          const allModules: Module[] = ['dashboard', 'banks', 'cards', 'locations', 'movements', 'users', 'logs', 'config']
          const allActions: Action[] = ['view', 'create', 'update', 'delete', 'import', 'export', 'print']
          const userPermissions = allModules.flatMap(module => 
            allActions.map(action => `${module}:${action}` as Permission)
          )
          setPermissions(userPermissions)
          setIsLoading(false)
          return
        }
        // Récupérer les permissions depuis la base de données
        try {
          const response = await authenticatedFetch('/api/roles')

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          const data = await response.json()
          
          if (data.success && Array.isArray(data.data)) {
            // Trouver le rôle correspondant à l'utilisateur (insensible à la casse)
            const userRole = data.data.find((role: any) => {
              if (!role || !role.role || typeof role.role !== 'string') {
                return false
              }
              if (!userData || !userData.role || typeof userData.role !== 'string') {
                return false
              }
              return role.role.toLowerCase() === userData.role.toLowerCase()
            })
            
            if (userRole && Array.isArray(userRole.permissions)) {
              // Utiliser les permissions directement comme strings
              const userPermissions = userRole.permissions
                .filter((p: any) => typeof p === 'string')
                .map((permission: string) => {
                  // Normaliser les actions : read -> view, create/update/delete restent identiques
                  return permission.replace(':read', ':view')
                })
              setPermissions(userPermissions)
            } else {
              // Si le rôle n'est pas trouvé, utiliser des permissions par défaut
              console.warn('[usePermissions] Rôle non trouvé dans /api/roles, utilisation des permissions par défaut')
              setPermissions(FALLBACK_PERMISSIONS)
            }
          } else {
            console.warn('[usePermissions] Réponse invalide de /api/roles, utilisation des permissions par défaut')
            setPermissions(FALLBACK_PERMISSIONS)
          }
        } catch (apiError) {
          console.error('[usePermissions] Erreur lors de la récupération des permissions:', apiError)
          // En cas d'erreur API, utiliser des permissions par défaut
          setPermissions(FALLBACK_PERMISSIONS)
        }
        
          setIsLoading(false)
        } catch (apiError) {
          console.error('Error fetching user from API:', apiError)
          clearAuthTokens()
          setUser(null)
          setPermissions([])
          setIsLoading(false)
          return
        }
      } catch (error) {
        console.error('Error loading permissions:', error)
        clearAuthTokens()
        setUser(null)
        setPermissions([])
        setIsLoading(false)
      }
    }

    loadUserAndPermissions()
  }, [])

  // Répercute immédiatement les changements de profil (avatar, nom...) faits par
  // l'utilisateur courant, sans attendre un rechargement complet de la page.
  useEffect(() => {
    const unsubscribe = eventBus.on("user:updated", (updatedUser: User) => {
      setUser((prev) => {
        if (!prev || prev.id !== updatedUser.id) return prev
        const merged = { ...prev, ...updatedUser }
        localStorage.setItem('currentUser', JSON.stringify(merged))
        return merged
      })
    })
    return unsubscribe
  }, [])

  const hasPermission = useCallback((module: Module, action: Action): boolean => {
    if (!user || permissions.length === 0) {
      return false
    }
    
    return permissions.includes(`${module}:${action}` as Permission)
  }, [user, permissions])

  const hasAnyPermission = useCallback((module: Module, actions: Action[]): boolean => {
    if (!user || permissions.length === 0) return false
    return actions.some(action => hasPermission(module, action))
  }, [user, permissions, hasPermission])

  const canAccessModule = useCallback((module: Module): boolean => {
    if (!user) return false
    if (permissions.length === 0) return false
    // Vérifier si l'utilisateur a au moins une permission pour ce module
    return permissions.some(p => p.startsWith(`${module}:`))
  }, [user, permissions])

  return {
    user,
    permissions,
    hasPermission,
    hasAnyPermission,
    canAccessModule,
    isLoading
  }
}
