import { type NextRequest, NextResponse } from "next/server"
import { dataStore } from "@/lib/data-store"
import type { ApiResponse } from "@/lib/api-types"
import type { Bank, BankFilters } from "@/lib/types"

// GET /api/banks - Récupérer toutes les banques avec filtres optionnels
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filters: BankFilters = {}

    const country = searchParams.get("country")
    const status = searchParams.get("status")
    const searchTerm = searchParams.get("search")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    if (country) filters.country = country
    if (status && (status === "active" || status === "inactive" || status === "all")) {
      filters.status = status
    }
    if (searchTerm) filters.searchTerm = searchTerm
    if (dateFrom) filters.dateFrom = new Date(dateFrom)
    if (dateTo) filters.dateTo = new Date(dateTo)

    const banks = Object.keys(filters).length > 0 ? dataStore.searchBanks(filters) : dataStore.getAllBanks()

    return NextResponse.json<ApiResponse<Bank[]>>({
      success: true,
      data: banks,
    })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération des banques",
      },
      { status: 500 },
    )
  }
}

// POST /api/banks - Créer une nouvelle banque
export async function POST(request: NextRequest) {
  try {
    const body: CreateBankRequest = await request.json()

    // Validation des champs requis
    if (!body.name || !body.code || !body.country || !body.swiftCode) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Champs requis manquants: name, code, country, swiftCode",
        },
        { status: 400 },
      )
    }

    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Format d'email invalide",
        },
        { status: 400 },
      )
    }

    if (body.swiftCode && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(body.swiftCode.toUpperCase())) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Format de code SWIFT invalide (8 ou 11 caractères)",
        },
        { status: 400 },
      )
    }

    const newBank = dataStore.addBank({
      name: body.name,
      code: body.code,
      country: body.country,
      swiftCode: body.swiftCode,
      address: body.address || "",
      phone: body.phone || "",
      email: body.email || "",
      isActive: body.isActive !== undefined ? body.isActive : true,
    })

    return NextResponse.json<ApiResponse<Bank>>(
      {
        success: true,
        data: newBank,
        message: "Banque créée avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création de la banque",
      },
      { status: 500 },
    )
  }
}

interface CreateBankRequest {
  name: string
  code: string
  country: string
  swiftCode: string
  address?: string
  phone?: string
  email?: string
  isActive?: boolean
}
