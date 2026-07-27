"use client"

import { Suspense } from "react"
import MovementsManagement from "@/components/dashboard/movements-management"

export default function MovementsPage() {
  return (
    <Suspense fallback={null}>
      <MovementsManagement />
    </Suspense>
  )
}
