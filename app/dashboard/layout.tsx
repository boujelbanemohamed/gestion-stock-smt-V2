"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import type { User } from "@/lib/types"
import { usePermissions } from "@/hooks/use-permissions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Menu, X } from "lucide-react"
import NotificationsDropdown from "@/components/notifications"
import GlobalSearch from "@/components/dashboard/global-search"
import RealtimeBridge from "@/components/dashboard/realtime-bridge"
import { IdleSessionDialog } from "@/components/dashboard/idle-session-dialog"
import { useThemeSync } from "@/hooks/use-theme-sync"
import { authenticatedFetch, logout } from "@/lib/api-client"

type NavigationItem = {
  name: string
  href: string
  icon: React.ReactNode
  permission?: string
}

const allNavigation: NavigationItem[] = [
  {
    name: "Aperçu",
    href: "/dashboard",
    permission: "dashboard:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
      </svg>
    ),
  },
  {
    name: "Banques",
    href: "/dashboard/banks",
    permission: "banks:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    name: "Cartes",
    href: "/dashboard/cards",
    permission: "cards:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
    ),
  },
  {
    name: "Emplacements",
    href: "/dashboard/locations",
    permission: "locations:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: "Mouvements",
    href: "/dashboard/movements",
    permission: "movements:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    ),
  },
  {
    name: "Inventaires",
    href: "/dashboard/inventories",
    // Même domaine que les mouvements : qui suit le stock suit les inventaires.
    permission: "movements:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
  },
  {
    name: "Statistiques",
    href: "/dashboard/statistics",
    permission: "movements:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    name: "Utilisateurs",
    href: "/dashboard/users",
    permission: "users:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
        />
      </svg>
    ),
  },
  {
    name: "Logs",
    href: "/dashboard/logs",
    permission: "logs:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    name: "Mon Profil",
    href: "/dashboard/profile",
    permission: "users:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  {
    name: "Configuration",
    href: "/dashboard/config",
    permission: "config:view",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user: currentUser, hasPermission, isLoading } = usePermissions()
  const [navigation, setNavigation] = useState<NavigationItem[]>([])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [dureesInactivite, setDureesInactivite] = useState({ warningMinutes: 15, logoutMinutes: 5 })
  const pathname = usePathname()
  useThemeSync()

  // Referme le menu mobile dès qu'on navigue vers une nouvelle page.
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Délais du minuteur d'inactivité, réglables dans Configuration > Sécurité.
  // Repli sur 15/5 minutes tant que la config n'est pas encore chargée.
  useEffect(() => {
    authenticatedFetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        const security = data?.data?.security
        if (security?.idleWarningMinutes && security?.idleLogoutMinutes) {
          setDureesInactivite({
            warningMinutes: security.idleWarningMinutes,
            logoutMinutes: security.idleLogoutMinutes,
          })
        }
      })
      .catch(() => {
        // Repli silencieux sur les valeurs par défaut déjà en place.
      })
  }, [])

  useEffect(() => {
    if (isLoading) return
    
    if (!currentUser) {
      // Nettoyer les tokens avant de rediriger
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('currentUser')
      }
      window.location.href = "/"
      return
    }
    
    // Filtrer la navigation selon les permissions
    const filteredNav = allNavigation.filter((item) => {
      // Si pas de permission définie, ne pas afficher (sécurité)
      if (!item.permission) return false
      
      // Extraire module et action de la permission (format "module:action")
      const [module, action] = item.permission.split(':')
      if (!module || !action) return false
      
      // Vérifier que hasPermission est disponible
      if (!hasPermission || typeof hasPermission !== 'function') {
        console.warn('[Layout] hasPermission non disponible')
        return false
      }
      
      try {
        return hasPermission(module as any, action as any)
      } catch (error) {
        console.error('[Layout] Erreur lors de la vérification de permission:', error)
        return false
      }
    })
    
    setNavigation(filteredNav)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, isLoading]) // Utiliser currentUser?.id au lieu de currentUser pour éviter les re-renders

  const handleLogout = () => {
    logout()
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default"
      case "manager":
        return "secondary"
      case "operator":
        return "outline"
      default:
        return "outline"
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <RealtimeBridge />
      <IdleSessionDialog
        warningMinutes={dureesInactivite.warningMinutes}
        logoutMinutes={dureesInactivite.logoutMinutes}
      />

      {/* Fond assombri derrière le menu mobile ouvert (barre latérale en tiroir) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar flottante : en tiroir (masquée par défaut) sur mobile, toujours visible dès md */}
      <div
        className={cn(
          "fixed left-4 top-4 bottom-4 z-30 w-64 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-lg overflow-y-auto transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 md:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-[120%]",
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between md:justify-center">
            <div className="flex flex-1 flex-col items-center space-y-2">
              <Image
                src="/images/monetique-logo.png"
                alt="Monétique Tunisie"
                width={160}
                height={50}
                className="object-contain h-12 w-auto"
                priority
              />
              <div className="text-center">
                <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Gestion de Stocks</h1>
                <p className="text-xs text-slate-600 dark:text-slate-400">Plateforme bancaire</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="ml-2 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {/* "Mon Profil" est affiché dans l'en-tête, pas dans la barre latérale */}
          {navigation.filter((item) => item.href !== "/dashboard/profile").map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-[#008DA8] text-black font-bold hover:bg-[#00758C]"
                    : "font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                )}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sur mobile, le compte et la recherche vivent dans le tiroir plutôt que
            dans l'en-tête (trop étroit pour tout afficher sur un petit écran). */}
        <div className="space-y-3 border-t border-slate-200 p-4 md:hidden dark:border-slate-800">
          <GlobalSearch />
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={currentUser?.avatarUrl || undefined} alt={`${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`} />
              <AvatarFallback className="text-xs">
                {currentUser?.firstName?.[0] || ""}
                {currentUser?.lastName?.[0] || ""}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {currentUser?.firstName || ''} {currentUser?.lastName || ''}
              </p>
              <Badge variant={getRoleBadgeVariant(currentUser?.role || 'user')} className="text-xs">
                {currentUser?.role ? (currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)) : 'User'}
              </Badge>
            </div>
          </div>
          <Link href="/dashboard/profile" className="block">
            <Button variant="outline" size="sm" className="w-full">
              Mon Profil
            </Button>
          </Link>
          <Button size="sm" onClick={handleLogout} className="w-full bg-red-600 text-white hover:bg-red-700">
            Déconnexion
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-4 mr-4 flex flex-col md:ml-72">
        {/* Header flottant, fixe comme la barre latérale */}
        <header className="fixed left-4 right-4 top-4 z-10 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-lg sm:px-6 dark:border-slate-800 dark:bg-slate-900 md:left-72">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-900 sm:text-xl dark:text-slate-100">
                  {navigation.find((item) => item.href === pathname)?.name || "Dashboard"}
                </h2>
                <p className="hidden truncate text-sm text-slate-600 sm:block dark:text-slate-400">
                  Gérez efficacement vos stocks de cartes bancaires
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {/* Toujours visible, y compris sur mobile où le reste (recherche,
                  compte, déconnexion) se trouve dans le tiroir latéral. */}
              <NotificationsDropdown />
              <div className="hidden items-center gap-4 md:flex">
                <div className="w-72">
                  <GlobalSearch />
                </div>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUser?.avatarUrl || undefined} alt={`${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`} />
                    <AvatarFallback className="text-xs">
                      {currentUser?.firstName?.[0] || ""}
                      {currentUser?.lastName?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {currentUser?.firstName || ''} {currentUser?.lastName || ''}
                    </p>
                    <Badge variant={getRoleBadgeVariant(currentUser?.role || 'user')} className="text-xs">
                      {currentUser?.role ? (currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)) : 'User'}
                    </Badge>
                  </div>
                </div>
                <Link href="/dashboard/profile">
                  <Button variant="outline" size="sm">
                    Mon Profil
                  </Button>
                </Link>
                <Button size="sm" onClick={handleLogout} className="bg-red-600 text-white hover:bg-red-700">
                  Déconnexion
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content (mt pour ne pas passer sous l'en-tête fixe) */}
        <main className="flex-1 p-4 mt-24 sm:p-6 sm:mt-28">{children}</main>
      </div>
    </div>
  )
}
