// Types pour la plateforme de gestion de stocks

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  lastLogin?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Bank {
  id: string
  name: string
  code: string
  address: string
  phone: string
  email: string
  country: string
  swiftCode: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Card {
  id: string
  name: string
  type: string // Type (ex. Carte débit)
  subType: string // Sous-type (ex. Mastercard)
  subSubType: string // Sous-sous-type (ex. National)
  bankId: string
  quantity: number
  minThreshold: number
  maxThreshold: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Location {
  id: string
  name: string
  description?: string
  bankId: string
  isActive: boolean
  totalCards?: number // Nombre total de cartes dans cette location
  createdAt: Date
  updatedAt: Date
}

export interface Movement {
  id: string
  cardId: string
  fromLocationId?: string
  toLocationId?: string
  movementType: "entry" | "exit" | "transfer"
  quantity: number
  reason: string
  userId: string
  createdAt: Date
}

export interface StockLevel {
  cardId: string
  locationId: string
  quantity: number
  lastUpdated: Date
}

export interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  fromEmail: string
  fromName: string
}

export interface NotificationSettings {
  enabled: boolean
  lowStockAlerts: boolean
  movementNotifications: boolean
  userActivityAlerts: boolean
  lowStockThreshold: number
  criticalStockThreshold: number
  emailNotifications: boolean
  inAppNotifications: boolean
  emailRecipients: string[]
}

// Helper type for organizing permissions by module
export interface ModulePermissions {
  module: Module
  label: string
  actions: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
}

export interface Notification {
  id: string
  type: "info" | "warning" | "error" | "success"
  title: string
  message: string
  userId?: string // If null, notification is for all users
  isRead: boolean
  createdAt: Date
}

export interface UserFilters {
  role?: string | "all"
  status?: "active" | "inactive" | "all"
  searchTerm?: string
}

export interface GeneralSettings {
  companyName: string
  logo: string
  language: string
  currency: string
  timezone: string
}

export interface DisplaySettings {
  dateFormat: string
  timeFormat: "12h" | "24h"
  numberFormat: string
  itemsPerPage: number
  theme: "light" | "dark" | "auto"
}

export interface TwoFactorSettings {
  enabled: boolean
  appName: string // Nom affiché dans l'authenticator
  issuer: string // Émetteur pour le QR code
  codeLength: number // Longueur du code (généralement 6)
  codePeriod: number // Période de validité en secondes (généralement 30)
  algorithm: "SHA1" | "SHA256" | "SHA512" // Algorithme de hachage
  mandatory: boolean // Forcer la 2FA pour tous les utilisateurs
  mandatoryRoles: string[] // Rôles qui doivent obligatoirement utiliser la 2FA
  gracePeriodDays: number // Période de grâce avant de forcer la 2FA (en jours)
}

export interface SecuritySettings {
  sessionDuration: number // in minutes
  requireStrongPassword: boolean
  minPasswordLength: number
  twoFactor: TwoFactorSettings
  maxLoginAttempts: number
  lockoutDuration: number // Durée de verrouillage après échec de connexion (en minutes)
}

export interface AppConfig {
  general: GeneralSettings
  smtp: SMTPConfig
  notifications: NotificationSettings
  display: DisplaySettings
  security: SecuritySettings
}

export interface BankImportRow {
  ID?: string
  CodeBanque: string
  NomBanque: string
  Pays: string
  SwiftCode: string
  Adresse?: string
  Telephone?: string
  Email?: string
}

export interface BankDetails {
  bank: Bank
  locations: Location[]
  cards: Array<{
    card: Card
    remainingQuantity: number
  }>
}

export interface BankFilters {
  country?: string
  status?: "active" | "inactive" | "all"
  dateFrom?: Date
  dateTo?: Date
  searchTerm?: string
}

export interface CardImportRow {
  ID?: string
  BanqueEmettrice: string
  NomCarte: string
  Type: string
  SousType: string
  SousSousType: string
}

export interface CardFilters {
  bankId?: string
  type?: string
  subType?: string
  subSubType?: string
  lowStock?: boolean
  searchTerm?: string
}

export interface CardDetails {
  card: Card
  bank: Bank
  remainingQuantity: number
}

export interface LocationImportRow {
  Banque: string
  NomEmplacement: string
  Description?: string
}

export interface LocationFilters {
  bankId?: string
  name?: string
  hasStock?: boolean
  searchTerm?: string
}

export interface LocationDetails {
  location: Location
  bank: Bank
  totalCards: number
  cardTypes: number
}

export type Module =
  | "banks"
  | "cards"
  | "locations"
  | "movements"
  | "users"
  | "reports"
  | "dashboard"
  | "config"
  | "logs"

export type Action = "create" | "read" | "update" | "delete" | "view" | "import" | "export" | "print"

export type Permission = `${Module}:${Action}`

export interface RolePermissions {
  id: string
  role: string
  permissions: Permission[]
  description: string
  isCustom: boolean
}

export interface AuditLog {
  id: string
  timestamp: Date
  userId: string
  userEmail: string
  action: string // e.g., "create", "update", "delete", "login", "logout"
  module: Module
  entityType: string // e.g., "user", "bank", "card", "role"
  entityId?: string
  entityName?: string
  details: string // Description of the action
  ipAddress?: string
  userAgent?: string
  status: "success" | "failure"
  errorMessage?: string
  userName?: string // Nom d'utilisateur pour l'affichage
  user?: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
  }
}

export interface LogFilters {
  userId?: string
  module?: Module | "all"
  action?: string | "all"
  status?: "success" | "failure" | "all"
  dateFrom?: Date
  dateTo?: Date
  searchTerm?: string
}
