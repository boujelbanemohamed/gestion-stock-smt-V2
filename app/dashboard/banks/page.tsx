"use client"

import { Suspense } from "react"
import BanksManagement from "@/components/dashboard/banks-management"

export default function BanksPage() {
  return (
    <Suspense fallback={null}>
      <BanksManagement />
    </Suspense>
  )
}
