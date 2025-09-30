import { NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"

export async function POST() {
  try {
    dataStore.logout()

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Déconnexion réussie",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la déconnexion",
      },
      { status: 500 },
    )
  }
}
