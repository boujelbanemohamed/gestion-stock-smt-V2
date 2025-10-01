import { useState, useEffect, useRef, useCallback } from "react"
import type { User, Permission, Module, Action } from "@/lib/types"

interface UserPermissions {
  user: User | null
  permissions: Permission[]
  hasPermission: (module: Module, action: Action) => boolean
  hasAnyPermission: (module: Module, actions: Action[]) => boolean
  canAccessModule: (module: Module) => boolean
  isLoading: boolean
}

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
        // Récupérer l'utilisateur depuis localStorage
        const storedUser = localStorage.getItem('currentUser')
        if (!storedUser) {
          setUser(null)
          setPermissions([])
          setIsLoading(false)
          return
        }

        const userData = JSON.parse(storedUser) as User
        setUser(userData)

        // Si c'est un super_admin ou admin, donner toutes les permissions
        if (userData.role === 'super_admin' || userData.role === 'admin') {
          const allModules: Module[] = ['dashboard', 'banks', 'cards', 'locations', 'movements', 'users', 'logs', 'config']
          const allActions: Action[] = ['view', 'create', 'update', 'delete', 'import', 'export', 'print']
          const userPermissions = allModules.flatMap(module => 
            allActions.map(action => ({ module, action }))
          )
          setPermissions(userPermissions)
          setIsLoading(false)
          return
        }

        // Récupérer les permissions depuis la base de données
        try {
          const response = await fetch('/api/roles')
          const data = await response.json()
          
          if (data.success) {
            // Trouver le rôle correspondant à l'utilisateur (insensible à la casse)
            const userRole = data.data.find((role: any) => 
              role.role.toLowerCase() === userData.role.toLowerCase()
            )
            
            if (userRole) {
              // Convertir les permissions de format "module:action" vers { module, action }
              const parsedPermissions = userRole.permissions.map((permission: string) => {
                const [module, action] = permission.split(':')
                // Normaliser les actions : read -> view, create/update/delete restent identiques
                const normalizedAction = action === 'read' ? 'view' : action
                return { module: module as Module, action: normalizedAction as Action }
              })
              setPermissions(parsedPermissions)
            } else {
              // Si le rôle n'est pas trouvé, utiliser des permissions par défaut
              setPermissions([])
            }
          } else {
            setPermissions([])
          }
        } catch (apiError) {
          console.error('Error fetching permissions from API:', apiError)
          // En cas d'erreur API, utiliser des permissions par défaut
          const defaultPermissions: { [key: string]: Permission[] } = {
            admin: [
              { module: 'dashboard', action: 'view' },
              { module: 'banks', action: 'view' },
              { module: 'cards', action: 'view' },
              { module: 'locations', action: 'view' },
              { module: 'movements', action: 'view' },
              { module: 'users', action: 'view' },
              { module: 'logs', action: 'view' },
              { module: 'config', action: 'view' }
            ],
            expedition: [
              { module: 'dashboard', action: 'view' },
              { module: 'banks', action: 'view' },
              { module: 'movements', action: 'view' }
            ],
            manager: [
              { module: 'dashboard', action: 'view' },
              { module: 'banks', action: 'view' },
              { module: 'cards', action: 'view' },
              { module: 'locations', action: 'view' },
              { module: 'movements', action: 'view' },
              { module: 'users', action: 'view' }
            ],
            user: [
              { module: 'dashboard', action: 'view' },
              { module: 'banks', action: 'view' },
              { module: 'cards', action: 'view' },
              { module: 'locations', action: 'view' },
              { module: 'movements', action: 'view' }
            ]
          }
          setPermissions(defaultPermissions[userData.role] || [])
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error('Error loading permissions:', error)
        setUser(null)
        setPermissions([])
        setIsLoading(false)
      }
    }

    loadUserAndPermissions()
  }, [])

  const hasPermission = useCallback((module: Module, action: Action): boolean => {
    if (!user || permissions.length === 0) {
      return false
    }
    
    return permissions.some(p => p.module === module && p.action === action)
  }, [user, permissions])

  const hasAnyPermission = useCallback((module: Module, actions: Action[]): boolean => {
    if (!user || permissions.length === 0) return false
    return actions.some(action => hasPermission(module, action))
  }, [user, permissions, hasPermission])

  const canAccessModule = useCallback((module: Module): boolean => {
    if (!user) return false
    if (permissions.length === 0) return false
    // Vérifier si l'utilisateur a au moins une permission pour ce module
    return permissions.some(p => p.module === module)
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
