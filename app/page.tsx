"use client"

import { useState, useEffect } from "react"
import { dataStore } from "@/lib/data-store"
import type { User } from "@/lib/types"
import LoginForm from "@/components/auth/login-form"

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const user = dataStore.getCurrentUser()
    if (user) {
      window.location.href = "/dashboard"
    } else {
      setCurrentUser(null)
      setIsLoading(false)
    }
  }, [])

  const handleLogin = (user: User) => {
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
