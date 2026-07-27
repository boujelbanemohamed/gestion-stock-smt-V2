"use client"

import { Suspense } from "react"
import UsersManagement from "@/components/dashboard/users-management"

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersManagement />
    </Suspense>
  )
}
