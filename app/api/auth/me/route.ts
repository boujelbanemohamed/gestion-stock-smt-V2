import { NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { User } from "@/lib/types"

export async function GET() {
  try {
    const user = dataStore.getCurrentUser()

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Non authentifié",
        },
        { status: 401 },
      )
    }

    return NextResponse.json<ApiResponse<User>>({
      success: true,
      data: user,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de l'utilisateur",
      },
      { status: 500 },
    )
  }
}
