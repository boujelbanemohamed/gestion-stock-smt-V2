// Types pour les réponses API standardisées

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  total?: number
  page?: number
  limit?: number
  totalPages?: number
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ImportResponse {
  success: boolean
  imported: number
  created: number
  updated: number
  rejected: number
  errors: string[]
  message?: string
}
