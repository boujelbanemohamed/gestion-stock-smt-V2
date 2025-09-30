import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { Location, LocationFilters } from "@/lib/types"

// GET /api/locations - Récupérer tous les emplacements avec filtres optionnels
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filters: LocationFilters = {}

    const bankId = searchParams.get("bankId")
    const name = searchParams.get("name")
    const hasStock = searchParams.get("hasStock")
    const searchTerm = searchParams.get("search")

    if (bankId) filters.bankId = bankId
    if (name) filters.name = name
    if (hasStock === "true") filters.hasStock = true
    if (hasStock === "false") filters.hasStock = false
    if (searchTerm) filters.searchTerm = searchTerm

    const locations = Object.keys(filters).length > 0 ? dataStore.searchLocations(filters) : dataStore.getLocations()

    return NextResponse.json<ApiResponse<Location[]>>({
      success: true,
      data: locations,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des emplacements",
      },
      { status: 500 },
    )
  }
}

// POST /api/locations - Créer un nouvel emplacement
export async function POST(request: NextRequest) {
  try {
    const body: CreateLocationRequest = await request.json()

    // Validation des champs requis
    if (!body.name || !body.bankId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Champs requis manquants: name, bankId",
        },
        { status: 400 },
      )
    }

    if (body.name.trim().length < 2) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Le nom doit contenir au moins 2 caractères",
        },
        { status: 400 },
      )
    }

    const newLocation = dataStore.addLocation({
      name: body.name,
      description: body.description || "",
      bankId: body.bankId,
      isActive: body.isActive !== undefined ? body.isActive : true,
    })

    return NextResponse.json<ApiResponse<Location>>(
      {
        success: true,
        data: newLocation,
        message: "Emplacement créé avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création de l'emplacement",
      },
      { status: 500 },
    )
  }
}

interface CreateLocationRequest {
  name: string
  bankId: string
  description?: string
  isActive?: boolean
}
