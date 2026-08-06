// Types pour la plateforme de gestion de stocks

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  avatarUrl?: string | null
  lastLogin?: Date | null
  createdAt: Date
  updatedAt: Date
  twoFactorEnabled?: boolean
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
  bank?: Bank
  stockLevels?: Array<{ id: string; locationId: string; quantity: number; location?: Location }>
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
  // Numéro imprimé sur le bordereau. Absent des mouvements enregistrés avant sa
  // mise en place : la ligne « Numéro » est alors masquée sur leur bordereau.
  reference?: string | null
  cardId: string
  fromLocationId?: string
  toLocationId?: string
  movementType: "entry" | "exit" | "transfer"
  quantity: number
  reason: string
  userId: string
  documentUrl?: string | null
  documentName?: string | null
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

// Permet d'activer/désactiver indépendamment, pour un type de notification
// donné, le canal in-app et le canal email.
export interface NotificationChannelToggle {
  inApp: boolean
  email: boolean
}

// Emails liés au cycle de vie d'un compte, envoyés directement à
// l'utilisateur concerné (pas aux destinataires configurés). N'ont pas
// d'équivalent in-app : ce sont des emails ponctuels, pas des notifications
// persistantes.
export interface AccountEmailSettings {
  welcomeEmail: boolean
  passwordResetEmail: boolean
  passwordChangedEmail: boolean
  authMethodChangedEmail: boolean
}

export interface NotificationSettings {
  enabled: boolean
  lowStockAlerts: NotificationChannelToggle
  movementNotifications: NotificationChannelToggle
  userActivityAlerts: NotificationChannelToggle
  accountEmails: AccountEmailSettings
  lowStockThreshold: number
  criticalStockThreshold: number
  // Interrupteurs généraux : s'ils sont désactivés, ils coupent le canal
  // correspondant pour tous les types de notifications, quels que soient
  // les réglages individuels ci-dessus. Les emails de compte critiques
  // (réinitialisation, confirmation de changement de mot de passe,
  // changement de méthode d'authentification) ne sont volontairement PAS
  // soumis à l'interrupteur général email : seul leur interrupteur
  // individuel les contrôle.
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
  idleSessionEnabled: boolean // Active ou désactive la déconnexion automatique pour inactivité
  idleWarningMinutes: number // Délai d'inactivité avant l'avertissement de déconnexion
  idleLogoutMinutes: number // Durée du compte à rebours avant déconnexion automatique
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
  // Absent des configurations enregistrées avant cette fonctionnalité : les
  // lectures passent par normaliserMotifParType(), qui comble le manque.
  movements?: MovementSettings
}

export interface MovementSettings {
  // Motif pré-sélectionné à la création, par type de mouvement.
  reasonByType: Record<"entry" | "exit" | "transfer", string | null>
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
  status?: "all" | "active" | "inactive"
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

export interface MovementReason {
  id: string
  label: string
  isOther: boolean
  isActive: boolean
  // Type de mouvement dont ce motif est le motif par défaut, ou null s'il n'en
  // porte aucun. Il n'existe pas de colonne correspondante : l'API le calcule à
  // partir de la configuration (voir lib/movement-reason-types.ts).
  movementType?: "entry" | "exit" | "transfer" | null
}

// Inventaire physique d'une banque : campagne de comptage sur le terrain.
export type InventoryStatus = "in_progress" | "completed" | "adjusted" | "cancelled"

export interface InventoryLine {
  id: string
  inventoryId: string
  cardId: string
  locationId: string
  /** Stock théorique figé à l'ouverture de l'inventaire. */
  expectedQuantity: number
  /** null tant que la ligne n'a pas été comptée. */
  countedQuantity: number | null
  notes?: string | null
  card?: { id: string; name: string; type: string; subType: string; subSubType: string }
  location?: { id: string; name: string }
}

export interface Inventory {
  id: string
  reference: string
  bankId: string
  status: InventoryStatus
  notes?: string | null
  startedAt: Date
  completedAt?: Date | null
  adjustedAt?: Date | null
  startedById: string
  bank?: { id: string; name: string; code: string; address?: string }
  startedBy?: { id: string; firstName: string; lastName: string; email: string }
  lines?: InventoryLine[]
  /** Champs calculés renvoyés par l'API pour la liste et le rapport. */
  totalLines?: number
  countedLines?: number
  discrepancyLines?: number
  totalExpected?: number
  totalCounted?: number
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
