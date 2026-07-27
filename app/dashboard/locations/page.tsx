"use client"

import { Suspense } from "react"
import LocationsManagement from "@/components/dashboard/locations-management"

export default function LocationsPage() {
  return (
    <Suspense fallback={null}>
      <LocationsManagement />
    </Suspense>
  )
}
