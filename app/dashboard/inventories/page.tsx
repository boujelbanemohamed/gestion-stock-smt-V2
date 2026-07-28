"use client"

import { Suspense } from "react"
import InventoriesManagement from "@/components/dashboard/inventories-management"

export default function InventoriesPage() {
  return (
    <Suspense fallback={null}>
      <InventoriesManagement />
    </Suspense>
  )
}
