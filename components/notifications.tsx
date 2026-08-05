"use client"

import { useState, useEffect } from "react"
import type { Notification } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { authenticatedFetch } from "@/lib/api-client"
import { useServerEvent } from "@/hooks/use-server-event"
import { toast } from "@/hooks/use-toast"

export default function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadNotifications()
    // Filet de sécurité si la connexion SSE (temps réel) venait à se couper :
    // la mise à jour en direct passe désormais par useServerEvent ci-dessous.
    const interval = setInterval(loadNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    try {
      // Récupérer l'utilisateur actuel depuis le localStorage ou le contexte
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null')
      if (currentUser) {
        // Récupérer toutes les notifications
        const response = await authenticatedFetch(`/api/notifications?userId=${currentUser.id}`)
        const data = await response.json()
        if (data.success) {
          const allNotifications = data.data.slice(0, 10) // Show last 10 notifications
          setNotifications(allNotifications)
          
          // Compter les notifications non lues
          const unreadCount = allNotifications.filter((n: Notification) => !n.isRead).length
          setUnreadCount(unreadCount)
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  // Une notification créée par n'importe quelle action (alerte de stock bas,
  // etc.) est poussée en temps réel via SSE : on recharge la liste dès réception.
  useServerEvent("notification", () => {
    loadNotifications()
  })

  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await authenticatedFetch(`/api/notifications/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isRead: true })
      })

      if (response.ok) {
        await loadNotifications()
      } else {
        toast({
          title: "Impossible de marquer la notification comme lue",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast({
        title: "Impossible de marquer la notification comme lue",
        description: "Une erreur est survenue.",
        variant: "destructive",
      })
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null')
      if (!currentUser) return

      // Marquer toutes les notifications non lues comme lues
      const unreadNotifications = notifications.filter(n => !n.isRead)
      if (unreadNotifications.length === 0) return

      const responses = await Promise.all(
        unreadNotifications.map(notification =>
          authenticatedFetch(`/api/notifications/${notification.id}`, {
            method: 'PUT',
            body: JSON.stringify({ isRead: true })
          })
        )
      )

      await loadNotifications()

      if (responses.some(r => !r.ok)) {
        toast({
          title: "Certaines notifications n'ont pas pu être marquées comme lues",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast({
        title: "Impossible de marquer les notifications comme lues",
        description: "Une erreur est survenue.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteNotification = async (id: string) => {
    try {
      const response = await authenticatedFetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadNotifications()
      } else {
        toast({
          title: "Impossible de supprimer la notification",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast({
        title: "Impossible de supprimer la notification",
        description: "Une erreur est survenue.",
        variant: "destructive",
      })
    }
  }

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return (
          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case "warning":
        return (
          <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg className="h-4 w-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        )
      case "error":
        return (
          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        )
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const notificationDate = new Date(date)
    const diffInMinutes = Math.floor((now.getTime() - notificationDate.getTime()) / 60000)

    if (diffInMinutes < 1) return "À l'instant"
    if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`
    if (diffInMinutes < 1440) return `Il y a ${Math.floor(diffInMinutes / 60)} h`
    return notificationDate.toLocaleDateString("fr-FR")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative bg-transparent">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      {/* 320px (w-80) ne suffisaient pas : la date et les deux actions ne
          tenaient pas sur une ligne et « Supprimer » était tronqué. On élargit,
          en plafonnant à la largeur de l'écran pour rester utilisable sur
          mobile, où 28rem dépasseraient. */}
      <DropdownMenuContent align="end" className="w-[min(28rem,calc(100vw-2rem))]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="h-auto p-1 text-xs">
              Tout marquer comme lu
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">Aucune notification</div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 border-b last:border-b-0 hover:bg-slate-50 ${!notification.isRead ? "bg-blue-50" : ""}`}
              >
                <div className="flex items-start space-x-3">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                      {!notification.isRead && <div className="h-2 w-2 rounded-full bg-blue-600 ml-2 mt-1" />}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 break-words">{notification.message}</p>
                    {/* flex-wrap : filet de sécurité si le libellé d'une action
                        s'allonge ou si l'écran est très étroit — la ligne passe
                        au-dessous au lieu de déborder. */}
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-2">
                      <p className="text-xs text-slate-400">{formatDate(notification.createdAt)}</p>
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="h-auto p-1 text-xs"
                          >
                            Marquer comme lu
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNotification(notification.id)}
                          className="h-auto p-1 text-xs text-red-600 hover:text-red-700"
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
