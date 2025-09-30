import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { AppConfig } from "@/lib/types"

// GET /api/config - Récupérer la configuration
export async function GET() {
  try {
    const config = dataStore.getConfig()

    return NextResponse.json<ApiResponse<AppConfig>>({
      success: true,
      data: config,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération de la configuration",
      },
      { status: 500 },
    )
  }
}

// PUT /api/config - Mettre à jour la configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    dataStore.updateConfig(body)

    return NextResponse.json<ApiResponse<AppConfig>>({
      success: true,
      data: body,
      message: "Configuration mise à jour avec succès",
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour de la configuration",
      },
      { status: 500 },
    )
  }
}
