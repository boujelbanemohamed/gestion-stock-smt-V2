import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { ApiResponse } from "@/lib/api-types"
import type { Location } from "@/lib/types"

// GET /api/locations - Récupérer tous les emplacements avec filtres optionnels
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const bankId = searchParams.get("bankId")
    const searchTerm = searchParams.get("search")

    const where: any = {}

    if (bankId) where.bankId = bankId
    
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    const locations = await prisma.location.findMany({
      where,
      include: {
        bank: true,
        stockLevels: {
          include: {
            card: {
              select: { id: true, name: true, type: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json<ApiResponse<Location[]>>({
      success: true,
      data: locations as Location[],
    })
  } catch (error) {
    console.error('Error fetching locations:', error)
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
    const body = await request.json()

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

    const newLocation = await prisma.location.create({
      data: {
        name: body.name,
        description: body.description || null,
        bankId: body.bankId,
        isActive: body.isActive !== undefined ? body.isActive : true,
      }
    })

    return NextResponse.json<ApiResponse<Location>>(
      {
        success: true,
        data: newLocation as Location,
        message: "Emplacement créé avec succès",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating location:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Erreur lors de la création de l'emplacement",
      },
      { status: 500 },
    )
  }
}