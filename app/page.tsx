"use client"

import { useState, useEffect } from "react"
import type { User } from "@/lib/types"
import LoginForm from "@/components/auth/login-form"

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté (session localStorage)
    const storedUser = localStorage.getItem('currentUser')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setCurrentUser(user)
        window.location.href = "/dashboard"
      } catch {
        localStorage.removeItem('currentUser')
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }, [])

  const handleLogin = (user: User) => {
    // Sauvegarder l'utilisateur dans localStorage
    localStorage.setItem('currentUser', JSON.stringify(user))
    setCurrentUser(user)
    window.location.href = "/dashboard"
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <LoginForm onLogin={handleLogin} />
}
