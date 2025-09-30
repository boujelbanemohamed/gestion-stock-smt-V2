import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Bank } from "@/lib/types"

// GET /api/banks - Récupérer toutes les banques avec filtres optionnels
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const country = searchParams.get("country")
    const status = searchParams.get("status")
    const searchTerm = searchParams.get("search")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    // Construire le filtre Prisma
    const where: any = {}

    if (country) where.country = country
    if (status === "active") where.isActive = true
    if (status === "inactive") where.isActive = false
    
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { swiftCode: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const banks = await prisma.bank.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json<ApiResponse<Bank[]>>({
      success: true,
      data: banks as Bank[],
    })
  } catch (error) {
    console.error('Error fetching banks:', error)
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

    // Vérifier si le code existe déjà
    const existingBank = await prisma.bank.findUnique({
      where: { code: body.code }
    })

    if (existingBank) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Une banque avec ce code existe déjà",
        },
        { status: 400 },
      )
    }

    const newBank = await prisma.bank.create({
      data: {
        name: body.name,
        code: body.code,
        country: body.country,
        swiftCode: body.swiftCode,
        address: body.address || "",
        phone: body.phone || "",
        email: body.email || "",
        isActive: body.isActive !== undefined ? body.isActive : true,
      }
    })

    return NextResponse.json<ApiResponse<Bank>>(
      {
        success: true,
        data: newBank as Bank,
        message: "Banque créée avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating bank:', error)
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
