// Store de données local pour la plateforme
import type {
  User,
  Bank,
  Card,
  Location,
  Movement,
  StockLevel,
  AppConfig,
  BankFilters,
  BankImportRow,
  CardImportRow,
  CardFilters,
  CardDetails,
  LocationImportRow,
  LocationFilters,
  LocationDetails,
  Permission,
  RolePermissions,
  Notification,
  Module,
  Action,
  AuditLog,
  LogFilters,
  UserFilters,
} from "./types"
import { eventBus } from "./event-bus"

class DataStore {
  private users: User[] = []
  private banks: Bank[] = []
  private cards: Card[] = []
  private locations: Location[] = []
  private movements: Movement[] = []
  private stockLevels: StockLevel[] = []
  private config: AppConfig | null = null
  private currentUser: User | null = null
  private notifications: Notification[] = []
  private auditLogs: AuditLog[] = []

  private rolePermissions: RolePermissions[] = [
    {
      id: "role-admin",
      role: "admin",
      permissions: [
        "banks:create",
        "banks:read",
        "banks:update",
        "banks:delete",
        "cards:create",
        "cards:read",
        "cards:update",
        "cards:delete",
        "locations:create",
        "locations:read",
        "locations:update",
        "locations:delete",
        "movements:create",
        "movements:read",
        "movements:update",
        "movements:delete",
        "users:create",
        "users:read",
        "users:update",
        "users:delete",
        "reports:read",
        "dashboard:read",
        "config:create",
        "config:read",
        "config:update",
        "config:delete",
        "logs:read",
      ],
      description: "Accès complet à toutes les fonctionnalités",
      isCustom: false,
    },
    {
      id: "role-manager",
      role: "manager",
      permissions: [
        "banks:create",
        "banks:read",
        "banks:update",
        "banks:delete",
        "cards:create",
        "cards:read",
        "cards:update",
        "cards:delete",
        "locations:create",
        "locations:read",
        "locations:update",
        "locations:delete",
        "movements:create",
        "movements:read",
        "movements:update",
        "movements:delete",
        "reports:read",
        "dashboard:read",
      ],
      description: "Gestion des banques, cartes, emplacements et mouvements",
      isCustom: false,
    },
    {
      id: "role-operator",
      role: "operator",
      permissions: ["movements:create", "movements:read", "cards:read", "locations:read", "dashboard:read"],
      description: "Gestion des mouvements uniquement",
      isCustom: false,
    },
    {
      id: "role-viewer",
      role: "viewer",
      permissions: ["banks:read", "cards:read", "locations:read", "movements:read", "dashboard:read", "reports:read"],
      description: "Consultation uniquement",
      isCustom: false,
    },
  ]

  constructor() {
    this.loadFromStorage()
    this.initializeDefaultData()
  }

  private saveToStorage() {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "stockManagement",
        JSON.stringify({
          users: this.users,
          banks: this.banks,
          cards: this.cards,
          locations: this.locations,
          movements: this.movements,
          stockLevels: this.stockLevels,
          // Removed cardCategories, cardTypeDefinitions, cardSubtypes from storage
          config: this.config,
          currentUser: this.currentUser,
          notifications: this.notifications,
          rolePermissions: this.rolePermissions,
          auditLogs: this.auditLogs,
        }),
      )
    }
  }

  private loadFromStorage() {
    if (typeof window !== "undefined") {
      const data = localStorage.getItem("stockManagement")
      if (data) {
        const parsed = JSON.parse(data)
        this.users = parsed.users || []
        this.banks = parsed.banks || []
        this.cards = parsed.cards || []
        this.locations = parsed.locations || []
        this.movements = parsed.movements || []
        this.stockLevels = parsed.stockLevels || []
        // Removed loading of cardCategories, cardTypeDefinitions, cardSubtypes
        this.config = parsed.config
        this.currentUser = parsed.currentUser
        this.notifications = parsed.notifications || []
        if (parsed.rolePermissions && parsed.rolePermissions.length > 0) {
          this.rolePermissions = parsed.rolePermissions
        }
        this.auditLogs = parsed.auditLogs || []

        this.migrateRolePermissions()
        this.migrateConfig()
      }
    }
  }

  private migrateRolePermissions() {
    // Define the default permissions for each role
    const defaultRolePermissions: { [role: string]: Permission[] } = {
      admin: [
        "banks:create",
        "banks:read",
        "banks:update",
        "banks:delete",
        "cards:create",
        "cards:read",
        "cards:update",
        "cards:delete",
        "locations:create",
        "locations:read",
        "locations:update",
        "locations:delete",
        "movements:create",
        "movements:read",
        "movements:update",
        "movements:delete",
        "users:create",
        "users:read",
        "users:update",
        "users:delete",
        "reports:read",
        "dashboard:read",
        "config:create",
        "config:read",
        "config:update",
        "config:delete",
        "logs:read",
      ],
      manager: [
        "banks:create",
        "banks:read",
        "banks:update",
        "banks:delete",
        "cards:create",
        "cards:read",
        "cards:update",
        "cards:delete",
        "locations:create",
        "locations:read",
        "locations:update",
        "locations:delete",
        "movements:create",
        "movements:read",
        "movements:update",
        "movements:delete",
        "reports:read",
        "dashboard:read",
      ],
      operator: ["movements:create", "movements:read", "cards:read", "locations:read", "dashboard:read"],
      viewer: ["banks:read", "cards:read", "locations:read", "movements:read", "dashboard:read", "reports:read"],
    }

    // Update non-custom roles with the latest permissions
    let updated = false
    this.rolePermissions.forEach((rolePerms) => {
      if (!rolePerms.isCustom && defaultRolePermissions[rolePerms.role]) {
        const newPermissions = defaultRolePermissions[rolePerms.role]
        // Check if permissions need updating
        if (JSON.stringify(rolePerms.permissions.sort()) !== JSON.stringify(newPermissions.sort())) {
          rolePerms.permissions = newPermissions
          updated = true
        }
      }
    })

    if (updated) {
      this.saveToStorage()
    }
  }

  private migrateConfig() {
    // If no config exists, create default one
    if (!this.config) {
      this.config = this.getDefaultConfig()
      this.saveToStorage()
      return
    }

    // Migrate old security structure to new one
    const oldConfig = this.config as any
    if (oldConfig.security && typeof oldConfig.security.requireTwoFactor === "boolean") {
      // Convert old structure to new structure
      const requireTwoFactor = oldConfig.security.requireTwoFactor
      this.config = {
        ...this.config,
        security: {
          ...this.config.security,
          twoFactor: {
            enabled: requireTwoFactor,
            appName: this.config.general?.companyName || "Stock Management",
            issuer: this.config.general?.companyName || "Stock Management",
            codeLength: 6,
            codePeriod: 30,
            algorithm: "SHA1",
            mandatory: false,
            mandatoryRoles: requireTwoFactor ? ["admin"] : [],
            gracePeriodDays: 7,
          },
        },
      }
      // Remove old property
      delete (this.config.security as any).requireTwoFactor
      this.saveToStorage()
    }

    // Ensure twoFactor exists even if config was partially migrated
    if (this.config.security && !this.config.security.twoFactor) {
      this.config.security.twoFactor = {
        enabled: false,
        appName: this.config.general?.companyName || "Stock Management",
        issuer: this.config.general?.companyName || "Stock Management",
        codeLength: 6,
        codePeriod: 30,
        algorithm: "SHA1",
        mandatory: false,
        mandatoryRoles: [],
        gracePeriodDays: 7,
      }
      this.saveToStorage()
    }

    if (this.config.notifications) {
      const oldNotifications = this.config.notifications as any
      if (oldNotifications.notificationRecipients !== undefined) {
        this.config.notifications.emailRecipients = oldNotifications.notificationRecipients
        delete oldNotifications.notificationRecipients
        this.saveToStorage()
      }
    }

    if (this.config.display && !(this.config.display as any).theme) {
      ;(this.config.display as any).theme = "light"
      this.saveToStorage()
    }

    if (this.config.security?.twoFactor) {
      const oldTwoFactor = this.config.security.twoFactor as any
      if (oldTwoFactor.requireForAllUsers !== undefined) {
        this.config.security.twoFactor.mandatory = oldTwoFactor.requireForAllUsers
        delete oldTwoFactor.requireForAllUsers
        this.saveToStorage()
      }
      if (oldTwoFactor.requiredRoles !== undefined) {
        this.config.security.twoFactor.mandatoryRoles = oldTwoFactor.requiredRoles
        delete oldTwoFactor.requiredRoles
        this.saveToStorage()
      }
    }
  }

  private getDefaultConfig(): AppConfig {
    return {
      general: {
        companyName: "Stock Management",
        logo: "",
        language: "fr",
        currency: "EUR",
        timezone: "Europe/Paris",
      },
      smtp: {
        host: "",
        port: 587,
        secure: false,
        username: "",
        password: "",
        fromEmail: "",
        fromName: "",
      },
      notifications: {
        enabled: true,
        lowStockAlerts: true,
        movementNotifications: true,
        userActivityAlerts: true,
        lowStockThreshold: 50,
        criticalStockThreshold: 20,
        emailNotifications: true,
        inAppNotifications: true,
        emailRecipients: [],
      },
      display: {
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24h",
        numberFormat: "fr-FR",
        itemsPerPage: 20,
        theme: "light",
      },
      security: {
        sessionDuration: 480,
        requireStrongPassword: true,
        minPasswordLength: 8,
        twoFactor: {
          enabled: false,
          appName: "Stock Management",
          issuer: "Stock Management",
          codeLength: 6,
          codePeriod: 30,
          algorithm: "SHA1",
          mandatory: false,
          mandatoryRoles: [],
          gracePeriodDays: 7,
        },
        maxLoginAttempts: 5,
        lockoutDuration: 30,
      },
    }
  }

  private initializeDefaultData() {
    if (this.users.length === 0) {
      this.users.push({
        id: "1",
        email: "admin@stockmanagement.com",
        firstName: "Admin",
        lastName: "System",
        role: "admin",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // The card type system now uses simple strings

      this.saveToStorage()
    }
  }

  login(email: string, password: string): { success: boolean; user: User | null; error?: string } {
    const user = this.users.find((u) => u.email === email)

    if (!user) {
      this.addLog({
        userId: "system",
        userEmail: email,
        action: "login",
        module: "users",
        entityType: "user",
        details: `Tentative de connexion échouée pour ${email}`,
        status: "failure",
        errorMessage: "Email ou mot de passe incorrect",
      })
      return { success: false, user: null, error: "Email ou mot de passe incorrect" }
    }

    if (!user.isActive) {
      this.addLog({
        userId: user.id,
        userEmail: user.email,
        action: "login",
        module: "users",
        entityType: "user",
        entityId: user.id,
        entityName: `${user.firstName} ${user.lastName}`,
        details: `Tentative de connexion d'un compte désactivé`,
        status: "failure",
        errorMessage: "Compte désactivé",
      })
      return {
        success: false,
        user: null,
        error: "Votre profil a été désactivé. Veuillez contacter l'administrateur.",
      }
    }

    this.currentUser = user
    this.saveToStorage()

    this.addLog({
      userId: user.id,
      userEmail: user.email,
      action: "login",
      module: "users",
      entityType: "user",
      entityId: user.id,
      entityName: `${user.firstName} ${user.lastName}`,
      details: `Connexion réussie`,
      status: "success",
    })

    return { success: true, user, error: undefined }
  }

  logout() {
    if (this.currentUser) {
      this.addLog({
        userId: this.currentUser.id,
        userEmail: this.currentUser.email,
        action: "logout",
        module: "users",
        entityType: "user",
        entityId: this.currentUser.id,
        entityName: `${this.currentUser.firstName} ${this.currentUser.lastName}`,
        details: `Déconnexion`,
        status: "success",
      })
    }
    this.currentUser = null
    this.saveToStorage()
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }

  getUserById(id: string): User | null {
    return this.users.find((u) => u.id === id) || null
  }

  getUsers(): User[] {
    return this.users
  }

  getAllUsers(): User[] {
    return this.users
  }

  getActiveUsers(): User[] {
    return this.users.filter((u) => u.isActive)
  }

  addUser(user: Omit<User, "id" | "createdAt" | "updatedAt">): User {
    const newUser: User = {
      ...user,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.users.push(newUser)
    this.saveToStorage()

    this.addNotification({
      type: "info",
      title: "Nouvel utilisateur créé",
      message: `${newUser.firstName} ${newUser.lastName} (${newUser.role}) a été ajouté au système`,
    })

    if (this.currentUser) {
      this.addLog({
        userId: this.currentUser.id,
        userEmail: this.currentUser.email,
        action: "create",
        module: "users",
        entityType: "user",
        entityId: newUser.id,
        entityName: `${newUser.firstName} ${newUser.lastName}`,
        details: `Création de l'utilisateur ${newUser.email} avec le rôle ${newUser.role}`,
        status: "success",
      })
    }

    eventBus.emit("user:created", newUser)
    return newUser
  }

  updateUser(id: string, updates: Partial<User>): User | null {
    const index = this.users.findIndex((u) => u.id === id)
    if (index !== -1) {
      const oldUser = { ...this.users[index] }
      this.users[index] = { ...this.users[index], ...updates, updatedAt: new Date() }
      this.saveToStorage()

      if (this.currentUser) {
        const changes: string[] = []
        if (updates.role && updates.role !== oldUser.role) {
          changes.push(`rôle: ${oldUser.role} → ${updates.role}`)
        }
        if (updates.isActive !== undefined && updates.isActive !== oldUser.isActive) {
          changes.push(`statut: ${oldUser.isActive ? "actif" : "inactif"} → ${updates.isActive ? "actif" : "inactif"}`)
        }
        if (updates.firstName && updates.firstName !== oldUser.firstName) {
          changes.push(`prénom: ${oldUser.firstName} → ${updates.firstName}`)
        }
        if (updates.lastName && updates.lastName !== oldUser.lastName) {
          changes.push(`nom: ${oldUser.lastName} → ${updates.lastName}`)
        }

        this.addLog({
          userId: this.currentUser.id,
          userEmail: this.currentUser.email,
          action: "update",
          module: "users",
          entityType: "user",
          entityId: this.users[index].id,
          entityName: `${this.users[index].firstName} ${this.users[index].lastName}`,
          details: `Modification de l'utilisateur: ${changes.join(", ")}`,
          status: "success",
        })
      }

      eventBus.emit("user:updated", this.users[index])
      return this.users[index]
    }
    return null
  }

  deleteUser(id: string): boolean {
    const index = this.users.findIndex((u) => u.id === id)
    if (index !== -1) {
      const user = this.users[index]
      this.users[index].isActive = false
      this.users[index].updatedAt = new Date()
      this.saveToStorage()

      if (this.currentUser) {
        this.addLog({
          userId: this.currentUser.id,
          userEmail: this.currentUser.email,
          action: "delete",
          module: "users",
          entityType: "user",
          entityId: user.id,
          entityName: `${user.firstName} ${user.lastName}`,
          details: `Désactivation de l'utilisateur ${user.email}`,
          status: "success",
        })
      }

      eventBus.emit("user:deleted", { id })
      return true
    }
    return false
  }

  toggleUserStatus(id: string): User | null {
    const index = this.users.findIndex((u) => u.id === id)
    if (index !== -1) {
      const oldStatus = this.users[index].isActive
      this.users[index].isActive = !this.users[index].isActive
      this.users[index].updatedAt = new Date()
      this.saveToStorage()

      if (this.currentUser) {
        this.addLog({
          userId: this.currentUser.id,
          userEmail: this.currentUser.email,
          action: "update",
          module: "users",
          entityType: "user",
          entityId: this.users[index].id,
          entityName: `${this.users[index].firstName} ${this.users[index].lastName}`,
          details: `Changement de statut: ${oldStatus ? "actif" : "inactif"} → ${this.users[index].isActive ? "actif" : "inactif"}`,
          status: "success",
        })
      }

      eventBus.emit("user:updated", this.users[index])
      return this.users[index]
    }
    return null
  }

  searchUsers(filters: UserFilters): User[] {
    let filteredUsers = this.users

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      filteredUsers = filteredUsers.filter(
        (user) =>
          user.firstName.toLowerCase().includes(term) ||
          user.lastName.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term),
      )
    }

    if (filters.role && filters.role !== "all") {
      filteredUsers = filteredUsers.filter((user) => user.role === filters.role)
    }

    if (filters.status && filters.status !== "all") {
      const isActive = filters.status === "active"
      filteredUsers = filteredUsers.filter((user) => user.isActive === isActive)
    }

    return filteredUsers
  }

  getBanks(): Bank[] {
    return this.banks.filter((b) => b.isActive)
  }

  getAllBanks(): Bank[] {
    return this.banks
  }

  getActiveBanks(): Bank[] {
    return this.banks.filter((b) => b.isActive)
  }

  getBankById(id: string): Bank | null {
    return this.banks.find((b) => b.id === id) || null
  }

  toggleBankStatus(id: string): Bank | null {
    const index = this.banks.findIndex((b) => b.id === id)
    if (index !== -1) {
      this.banks[index].isActive = !this.banks[index].isActive
      this.banks[index].updatedAt = new Date()
      this.saveToStorage()
      eventBus.emit("bank:updated", this.banks[index])
      return this.banks[index]
    }
    return null
  }

  searchBanks(filters: BankFilters): Bank[] {
    let filteredBanks = this.banks

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      filteredBanks = filteredBanks.filter(
        (bank) =>
          bank.name.toLowerCase().includes(term) ||
          bank.code.toLowerCase().includes(term) ||
          bank.country.toLowerCase().includes(term),
      )
    }

    if (filters.country) {
      filteredBanks = filteredBanks.filter((bank) => bank.country === filters.country)
    }

    if (filters.status && filters.status !== "all") {
      const isActive = filters.status === "active"
      filteredBanks = filteredBanks.filter((bank) => bank.isActive === isActive)
    }

    if (filters.dateFrom) {
      filteredBanks = filteredBanks.filter((bank) => new Date(bank.createdAt) >= filters.dateFrom!)
    }

    if (filters.dateTo) {
      filteredBanks = filteredBanks.filter((bank) => new Date(bank.createdAt) <= filters.dateTo!)
    }

    return filteredBanks
  }

  getCountries(): string[] {
    const countries = [...new Set(this.banks.map((bank) => bank.country))]
    return countries.filter((country) => country && country.trim() !== "")
  }

  importBanks(banks: BankImportRow[]): { success: Bank[]; errors: string[] } {
    const success: Bank[] = []
    const errors: string[] = []

    banks.forEach((row, index) => {
      try {
        if (!row.CodeBanque || !row.NomBanque || !row.Pays || !row.SwiftCode) {
          errors.push(`Ligne ${index + 1}: Champs obligatoires manquants`)
          return
        }

        if (this.banks.some((b) => b.code === row.CodeBanque)) {
          errors.push(`Ligne ${index + 1}: Code banque ${row.CodeBanque} déjà existant`)
          return
        }

        const newBank: Bank = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: row.NomBanque,
          code: row.CodeBanque,
          country: row.Pays,
          swiftCode: row.SwiftCode,
          address: row.Adresse || "",
          phone: row.Telephone || "",
          email: row.Email || "",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        this.banks.push(newBank)
        success.push(newBank)
      } catch (error) {
        errors.push(`Ligne ${index + 1}: Erreur lors du traitement`)
      }
    })

    if (success.length > 0) {
      this.saveToStorage()
      eventBus.emit("data:refresh")
    }

    return { success, errors }
  }

  addBank(bank: Omit<Bank, "id" | "createdAt" | "updatedAt">): Bank {
    const newBank: Bank = {
      ...bank,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.banks.push(newBank)
    this.saveToStorage()
    eventBus.emit("bank:created", newBank)
    return newBank
  }

  updateBank(id: string, updates: Partial<Bank>): Bank | null {
    const index = this.banks.findIndex((b) => b.id === id)
    if (index !== -1) {
      this.banks[index] = { ...this.banks[index], ...updates, updatedAt: new Date() }
      this.saveToStorage()
      eventBus.emit("bank:updated", this.banks[index])
      return this.banks[index]
    }
    return null
  }

  deleteBank(id: string): boolean {
    const index = this.banks.findIndex((b) => b.id === id)
    if (index !== -1) {
      this.banks[index].isActive = false
      this.saveToStorage()
      eventBus.emit("bank:deleted", { id })
      return true
    }
    return false
  }

  getCards(): Card[] {
    return this.cards.filter((c) => c.isActive)
  }

  getAllCards(): Card[] {
    return this.cards
  }

  getActiveCards(): Card[] {
    return this.cards.filter((c) => c.isActive)
  }

  getCardById(id: string): Card | null {
    return this.cards.find((c) => c.id === id) || null
  }

  addCard(card: Omit<Card, "id" | "createdAt" | "updatedAt">): Card {
    const newCard: Card = {
      ...card,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.cards.push(newCard)
    this.saveToStorage()
    eventBus.emit("card:created", newCard)
    return newCard
  }

  updateCard(id: string, updates: Partial<Card>): Card | null {
    const index = this.cards.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.cards[index] = { ...this.cards[index], ...updates, updatedAt: new Date() }
      this.saveToStorage()
      eventBus.emit("card:updated", this.cards[index])
      return this.cards[index]
    }
    return null
  }

  deleteCard(id: string): boolean {
    const index = this.cards.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.cards[index].isActive = false
      this.saveToStorage()
      eventBus.emit("card:deleted", { id })
      return true
    }
    return false
  }

  searchCards(filters: CardFilters): Card[] {
    let filteredCards = this.cards.filter((c) => c.isActive)

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      filteredCards = filteredCards.filter(
        (card) =>
          card.name.toLowerCase().includes(term) ||
          card.type.toLowerCase().includes(term) ||
          card.subType.toLowerCase().includes(term) ||
          card.subSubType.toLowerCase().includes(term),
      )
    }

    if (filters.bankId) {
      filteredCards = filteredCards.filter((card) => card.bankId === filters.bankId)
    }

    if (filters.type) {
      filteredCards = filteredCards.filter((card) => card.type === filters.type)
    }

    if (filters.subType) {
      filteredCards = filteredCards.filter((card) => card.subType === filters.subType)
    }

    if (filters.subSubType) {
      filteredCards = filteredCards.filter((card) => card.subSubType === filters.subSubType)
    }

    if (filters.lowStock) {
      filteredCards = filteredCards.filter((card) => card.quantity < 50)
    }

    return filteredCards
  }

  getCardTypes(): string[] {
    return [...new Set(this.cards.map((card) => card.type))].filter(Boolean)
  }

  getCardSubTypes(): string[] {
    return [...new Set(this.cards.map((card) => card.subType))].filter(Boolean)
  }

  getCardSubSubTypes(): string[] {
    return [...new Set(this.cards.map((card) => card.subSubType))].filter(Boolean)
  }

  importCards(cards: CardImportRow[]): { success: Card[]; errors: string[] } {
    const success: Card[] = []
    const errors: string[] = []

    cards.forEach((row, index) => {
      try {
        if (!row.BanqueEmettrice || !row.NomCarte || !row.Type || !row.SousType || !row.SousSousType) {
          errors.push(`Ligne ${index + 1}: Champs obligatoires manquants`)
          return
        }

        const bank = this.banks.find((b) => b.name === row.BanqueEmettrice && b.isActive)
        if (!bank) {
          errors.push(`Ligne ${index + 1}: Banque "${row.BanqueEmettrice}" introuvable`)
          return
        }

        const exists = this.cards.some(
          (c) =>
            c.bankId === bank.id &&
            c.name === row.NomCarte &&
            c.type === row.Type &&
            c.subType === row.SousType &&
            c.subSubType === row.SousSousType,
        )

        if (exists) {
          errors.push(`Ligne ${index + 1}: Carte déjà existante`)
          return
        }

        const newCard: Card = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: row.NomCarte,
          type: row.Type,
          subType: row.SousType,
          subSubType: row.SousSousType,
          bankId: bank.id,
          quantity: 0,
          minThreshold: 50,
          maxThreshold: 1000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        this.cards.push(newCard)
        success.push(newCard)
      } catch (error) {
        errors.push(`Ligne ${index + 1}: Erreur lors du traitement`)
      }
    })

    if (success.length > 0) {
      this.saveToStorage()
      eventBus.emit("data:refresh")
    }

    return { success, errors }
  }

  getCardsGroupedByBank(): { [bankName: string]: CardDetails[] } {
    const grouped: { [bankName: string]: CardDetails[] } = {}

    this.cards
      .filter((c) => c.isActive)
      .forEach((card) => {
        const bank = this.getBankById(card.bankId)
        if (bank) {
          if (!grouped[bank.name]) {
            grouped[bank.name] = []
          }
          grouped[bank.name].push({
            card,
            bank,
            remainingQuantity: card.quantity,
          })
        }
      })

    return grouped
  }

  getLocations(): Location[] {
    return this.locations.filter((l) => l.isActive)
  }

  getAllLocations(): Location[] {
    return this.locations
  }

  getActiveLocations(): Location[] {
    return this.locations.filter((l) => l.isActive)
  }

  getLocationById(id: string): Location | null {
    return this.locations.find((l) => l.id === id) || null
  }

  toggleLocationStatus(id: string): Location | null {
    const index = this.locations.findIndex((l) => l.id === id)
    if (index !== -1) {
      this.locations[index].isActive = !this.locations[index].isActive
      this.locations[index].updatedAt = new Date()
      this.saveToStorage()
      eventBus.emit("location:updated", this.locations[index])
      return this.locations[index]
    }
    return null
  }

  addLocation(location: Omit<Location, "id" | "createdAt" | "updatedAt">): Location {
    const newLocation: Location = {
      ...location,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.locations.push(newLocation)
    this.saveToStorage()
    eventBus.emit("location:created", newLocation)
    return newLocation
  }

  updateLocation(id: string, updates: Partial<Location>): Location | null {
    const index = this.locations.findIndex((l) => l.id === id)
    if (index !== -1) {
      this.locations[index] = { ...this.locations[index], ...updates, updatedAt: new Date() }
      this.saveToStorage()
      eventBus.emit("location:updated", this.locations[index])
      return this.locations[index]
    }
    return null
  }

  deleteLocation(id: string): boolean {
    const index = this.locations.findIndex((l) => l.id === id)
    if (index !== -1) {
      this.locations[index].isActive = false
      this.saveToStorage()
      eventBus.emit("location:deleted", { id })
      return true
    }
    return false
  }

  importLocations(locations: LocationImportRow[]): { success: Location[]; errors: string[] } {
    const success: Location[] = []
    const errors: string[] = []

    locations.forEach((row, index) => {
      try {
        if (!row.Banque || !row.NomEmplacement) {
          errors.push(`Ligne ${index + 1}: Champs obligatoires manquants`)
          return
        }

        const bank = this.banks.find((b) => b.name === row.Banque && b.isActive)
        if (!bank) {
          errors.push(`Ligne ${index + 1}: Banque "${row.Banque}" introuvable`)
          return
        }

        const exists = this.locations.some((l) => l.bankId === bank.id && l.name === row.NomEmplacement)

        if (exists) {
          errors.push(`Ligne ${index + 1}: Emplacement "${row.NomEmplacement}" déjà existant pour cette banque`)
          return
        }

        const newLocation: Location = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: row.NomEmplacement,
          description: row.Description || "",
          bankId: bank.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        this.locations.push(newLocation)
        success.push(newLocation)
      } catch (error) {
        errors.push(`Ligne ${index + 1}: Erreur lors du traitement`)
      }
    })

    if (success.length > 0) {
      this.saveToStorage()
      eventBus.emit("data:refresh")
    }

    return { success, errors }
  }

  searchLocations(filters: LocationFilters): Location[] {
    let filteredLocations = this.locations.filter((l) => l.isActive)

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      filteredLocations = filteredLocations.filter((location) => {
        const bank = this.getBankById(location.bankId)
        return (
          location.name.toLowerCase().includes(term) ||
          (location.description && location.description.toLowerCase().includes(term)) ||
          (bank && bank.name.toLowerCase().includes(term))
        )
      })
    }

    if (filters.bankId) {
      filteredLocations = filteredLocations.filter((location) => location.bankId === filters.bankId)
    }

    if (filters.name) {
      const term = filters.name.toLowerCase()
      filteredLocations = filteredLocations.filter((location) => location.name.toLowerCase().includes(term))
    }

    if (filters.hasStock !== undefined) {
      filteredLocations = filteredLocations.filter((location) => {
        const cards = this.getCardsByLocation(location.id)
        const hasStock = cards.length > 0
        return hasStock === filters.hasStock
      })
    }

    return filteredLocations
  }

  getLocationsGroupedByBank(): { [bankName: string]: LocationDetails[] } {
    const grouped: { [bankName: string]: LocationDetails[] } = {}

    this.locations
      .filter((l) => l.isActive)
      .forEach((location) => {
        const bank = this.getBankById(location.bankId)
        if (bank) {
          if (!grouped[bank.name]) {
            grouped[bank.name] = []
          }

          const cards = this.getCardsByLocation(location.id)
          const totalCards = cards.reduce((sum, item) => sum + item.quantity, 0)

          grouped[bank.name].push({
            location,
            bank,
            totalCards,
            cardTypes: cards.length,
          })
        }
      })

    return grouped
  }

  getCardsByLocation(locationId: string): { card: Card; quantity: number }[] {
    const cardQuantities = new Map<string, number>()

    this.movements.forEach((movement) => {
      const currentQty = cardQuantities.get(movement.cardId) || 0

      if (movement.movementType === "entry" && movement.toLocationId === locationId) {
        cardQuantities.set(movement.cardId, currentQty + movement.quantity)
      }

      if (movement.movementType === "exit" && movement.fromLocationId === locationId) {
        cardQuantities.set(movement.cardId, currentQty - movement.quantity)
      }

      if (movement.movementType === "transfer") {
        if (movement.toLocationId === locationId) {
          cardQuantities.set(movement.cardId, currentQty + movement.quantity)
        }
        if (movement.fromLocationId === locationId) {
          const qty = cardQuantities.get(movement.cardId) || 0
          cardQuantities.set(movement.cardId, qty - movement.quantity)
        }
      }
    })

    const result: { card: Card; quantity: number }[] = []
    cardQuantities.forEach((quantity, cardId) => {
      const card = this.cards.find((c) => c.id === cardId)
      if (card && card.isActive && quantity > 0) {
        result.push({ card, quantity })
      }
    })

    return result.sort((a, b) => a.card.name.localeCompare(b.card.name))
  }

  getMovements(): Movement[] {
    return this.movements
  }

  addMovement(movement: Omit<Movement, "id" | "createdAt">): Movement {
    const newMovement: Movement = {
      ...movement,
      id: Date.now().toString(),
      createdAt: new Date(),
    }
    this.movements.push(newMovement)

    this.updateCardQuantities(newMovement)

    const card = this.cards.find((c) => c.id === movement.cardId)
    if (card) {
      const remainingQuantity = card.quantity
      if (remainingQuantity <= card.minThreshold) {
        this.addNotification({
          type: "warning",
          title: "Seuil de stock atteint",
          message: `La carte "${card.name}" a atteint le seuil minimum (${remainingQuantity}/${card.minThreshold})`,
        })
      }
    }

    this.updateStockLevels(newMovement)
    this.saveToStorage()
    eventBus.emit("movement:created", newMovement)
    return newMovement
  }

  updateMovement(id: string, updates: Partial<Movement>): Movement | null {
    const index = this.movements.findIndex((m) => m.id === id)
    if (index !== -1) {
      const oldMovement = { ...this.movements[index] }

      // Revert old movement quantities
      this.revertCardQuantities(oldMovement)

      // Apply updates
      this.movements[index] = { ...this.movements[index], ...updates }

      // Apply new quantities
      this.updateCardQuantities(this.movements[index])

      this.saveToStorage()
      eventBus.emit("movement:updated", this.movements[index])
      return this.movements[index]
    }
    return null
  }

  deleteMovement(id: string): boolean {
    const index = this.movements.findIndex((m) => m.id === id)
    if (index !== -1) {
      const movement = this.movements[index]

      // Revert the quantities before deleting
      this.revertCardQuantities(movement)

      this.movements.splice(index, 1)
      this.saveToStorage()
      eventBus.emit("movement:deleted", { id })
      return true
    }
    return false
  }

  private updateCardQuantities(movement: Movement) {
    const card = this.cards.find((c) => c.id === movement.cardId)
    if (!card) return

    if (movement.movementType === "entry") {
      // Entry increases total stock
      card.quantity += movement.quantity
      card.updatedAt = new Date()
    } else if (movement.movementType === "exit") {
      // Exit decreases total stock
      card.quantity = Math.max(0, card.quantity - movement.quantity)
      card.updatedAt = new Date()
    }
    // Transfer doesn't change total stock, just location
  }

  private revertCardQuantities(movement: Movement) {
    const card = this.cards.find((c) => c.id === movement.cardId)
    if (!card) return

    if (movement.movementType === "entry") {
      // Revert entry by decreasing stock
      card.quantity = Math.max(0, card.quantity - movement.quantity)
      card.updatedAt = new Date()
    } else if (movement.movementType === "exit") {
      // Revert exit by increasing stock
      card.quantity += movement.quantity
      card.updatedAt = new Date()
    }
    // Transfer doesn't change total stock
  }

  private updateStockLevels(movement: Movement) {}

  getRolePermissions(): RolePermissions[] {
    return this.rolePermissions
  }

  getPermissionsForRole(role: string): Permission[] {
    const rolePerms = this.rolePermissions.find((rp) => rp.role === role)
    return rolePerms ? rolePerms.permissions : []
  }

  addRole(role: Omit<RolePermissions, "id">): RolePermissions {
    const newRole: RolePermissions = {
      ...role,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    }
    this.rolePermissions.push(newRole)
    this.saveToStorage()

    if (this.currentUser) {
      this.addLog({
        userId: this.currentUser.id,
        userEmail: this.currentUser.email,
        action: "create",
        module: "users",
        entityType: "role",
        entityId: newRole.id,
        entityName: newRole.role,
        details: `Création du rôle "${newRole.role}" avec ${newRole.permissions.length} permissions`,
        status: "success",
      })
    }

    return newRole
  }

  updateRole(id: string, updates: Partial<RolePermissions>): RolePermissions | null {
    const index = this.rolePermissions.findIndex((r) => r.id === id)
    if (index !== -1) {
      const oldRole = { ...this.rolePermissions[index] }
      if (!this.rolePermissions[index].isCustom && updates.isCustom !== undefined) {
        delete updates.isCustom
      }
      this.rolePermissions[index] = { ...this.rolePermissions[index], ...updates }
      this.saveToStorage()

      if (this.currentUser) {
        const changes: string[] = []
        if (updates.permissions) {
          const added = updates.permissions.filter((p) => !oldRole.permissions.includes(p))
          const removed = oldRole.permissions.filter((p) => !updates.permissions!.includes(p))
          if (added.length > 0) changes.push(`+${added.length} permissions`)
          if (removed.length > 0) changes.push(`-${removed.length} permissions`)
        }
        if (updates.description && updates.description !== oldRole.description) {
          changes.push("description modifiée")
        }

        this.addLog({
          userId: this.currentUser.id,
          userEmail: this.currentUser.email,
          action: "update",
          module: "users",
          entityType: "role",
          entityId: this.rolePermissions[index].id,
          entityName: this.rolePermissions[index].role,
          details: `Modification du rôle "${this.rolePermissions[index].role}": ${changes.join(", ")}`,
          status: "success",
        })
      }

      return this.rolePermissions[index]
    }
    return null
  }

  deleteRole(id: string): boolean {
    const index = this.rolePermissions.findIndex((r) => r.id === id)
    if (index !== -1) {
      if (!this.rolePermissions[index].isCustom) {
        return false
      }
      const role = this.rolePermissions[index]
      this.rolePermissions.splice(index, 1)
      this.saveToStorage()

      if (this.currentUser) {
        this.addLog({
          userId: this.currentUser.id,
          userEmail: this.currentUser.email,
          action: "delete",
          module: "users",
          entityType: "role",
          entityId: role.id,
          entityName: role.role,
          details: `Suppression du rôle personnalisé "${role.role}"`,
          status: "success",
        })
      }

      return true
    }
    return false
  }

  getAllPermissions(): Permission[] {
    const modules: Module[] = [
      "banks",
      "cards",
      "locations",
      "movements",
      "users",
      "reports",
      "dashboard",
      "config",
      "logs",
    ]
    const actions: Action[] = ["create", "read", "update", "delete"]
    const permissions: Permission[] = []

    modules.forEach((module) => {
      actions.forEach((action) => {
        if ((module === "reports" || module === "dashboard" || module === "logs") && action !== "read") {
          return
        }
        permissions.push(`${module}:${action}` as Permission)
      })
    })

    return permissions
  }

  hasModulePermission(userId: string, module: Module, action: Action): boolean {
    const permission: Permission = `${module}:${action}`
    return this.hasPermission(userId, permission)
  }

  hasPermission(userId: string, permission: Permission): boolean {
    const user = this.getUserById(userId)
    if (!user || !user.isActive) return false

    const permissions = this.getPermissionsForRole(user.role)
    return permissions.includes(permission)
  }

  canAccessPage(userId: string, page: string): boolean {
    const user = this.getUserById(userId)
    if (!user || !user.isActive) return false

    if (user.role === "admin") return true

    const pagePermissions: { [key: string]: Permission } = {
      "/dashboard/banks": "banks:read",
      "/dashboard/cards": "cards:read",
      "/dashboard/locations": "locations:read",
      "/dashboard/movements": "movements:read",
      "/dashboard/users": "users:read",
      "/dashboard/config": "config:read",
      "/dashboard/logs": "logs:read",
    }

    const requiredPermission = pagePermissions[page]
    if (!requiredPermission) return true

    return this.hasPermission(userId, requiredPermission)
  }

  getNotifications(userId?: string): Notification[] {
    if (userId) {
      return this.notifications
        .filter((n) => !n.userId || n.userId === userId)
        .sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
    }
    return this.notifications.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  getUnreadNotifications(userId?: string): Notification[] {
    return this.getNotifications(userId).filter((n) => !n.isRead)
  }

  addNotification(notification: Omit<Notification, "id" | "isRead" | "createdAt">): Notification {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      isRead: false,
      createdAt: new Date(),
    }
    this.notifications.push(newNotification)
    this.saveToStorage()
    return newNotification
  }

  updateNotification(id: string, updates: Partial<Notification>): Notification | null {
    const index = this.notifications.findIndex((n) => n.id === id)
    if (index !== -1) {
      this.notifications[index] = { ...this.notifications[index], ...updates }
      this.saveToStorage()
      return this.notifications[index]
    }
    return null
  }

  markNotificationAsRead(id: string): boolean {
    const index = this.notifications.findIndex((n) => n.id === id)
    if (index !== -1) {
      this.notifications[index].isRead = true
      this.saveToStorage()
      return true
    }
    return false
  }

  markAllNotificationsAsRead(userId?: string): boolean {
    let updated = false
    this.notifications.forEach((notification) => {
      if (!notification.isRead && (!userId || !notification.userId || notification.userId === userId)) {
        notification.isRead = true
        updated = true
      }
    })
    if (updated) {
      this.saveToStorage()
    }
    return updated
  }

  deleteNotification(id: string): boolean {
    const index = this.notifications.findIndex((n) => n.id === id)
    if (index !== -1) {
      this.notifications.splice(index, 1)
      this.saveToStorage()
      return true
    }
    return false
  }

  getConfig(): AppConfig {
    if (!this.config) {
      this.config = this.getDefaultConfig()
      this.saveToStorage()
    }
    return this.config
  }

  updateConfig(config: AppConfig) {
    this.config = config
    this.saveToStorage()
    eventBus.emit("config:updated", config)
  }

  addLog(log: Omit<AuditLog, "id" | "timestamp">): AuditLog {
    const newLog: AuditLog = {
      ...log,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    }
    this.auditLogs.push(newLog)
    this.saveToStorage()
    return newLog
  }

  getLogs(): AuditLog[] {
    return this.auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  searchLogs(filters: LogFilters): AuditLog[] {
    let filteredLogs = this.auditLogs

    if (filters.userId) {
      filteredLogs = filteredLogs.filter((log) => log.userId === filters.userId)
    }

    if (filters.module && filters.module !== "all") {
      filteredLogs = filteredLogs.filter((log) => log.module === filters.module)
    }

    if (filters.action && filters.action !== "all") {
      filteredLogs = filteredLogs.filter((log) => log.action === filters.action)
    }

    if (filters.status && filters.status !== "all") {
      filteredLogs = filteredLogs.filter((log) => log.status === filters.status)
    }

    if (filters.dateFrom) {
      filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp) >= filters.dateFrom!)
    }

    if (filters.dateTo) {
      filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp) <= filters.dateTo!)
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.userEmail.toLowerCase().includes(term) ||
          log.details.toLowerCase().includes(term) ||
          (log.entityName && log.entityName.toLowerCase().includes(term)),
      )
    }

    return filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  getTodayMovementsCount(): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return this.movements.filter((movement) => {
      const movementDate = new Date(movement.createdAt)
      movementDate.setHours(0, 0, 0, 0)
      return movementDate.getTime() === today.getTime()
    }).length
  }

  getMovementsCountByDateRange(dateFrom?: Date, dateTo?: Date): number {
    let filteredMovements = this.movements

    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      filteredMovements = filteredMovements.filter((movement) => {
        const movementDate = new Date(movement.createdAt)
        movementDate.setHours(0, 0, 0, 0)
        return movementDate >= from
      })
    }

    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      filteredMovements = filteredMovements.filter((movement) => {
        return new Date(movement.createdAt) <= to
      })
    }

    return filteredMovements.length
  }

  getRecentLogs(hours = 24): AuditLog[] {
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - hours)

    return this.auditLogs
      .filter((log) => new Date(log.timestamp) >= cutoffTime)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10) // Limit to 10 most recent logs
  }

  getStats(): {
    totalBanks: number
    totalCardTypes: number
    totalLocations: number
    todayMovements: number
    totalCards: number
    lowStockCards: number
    activeUsers: number
  } {
    const activeBanks = this.getActiveBanks()
    const activeCards = this.getCards()
    const activeLocations = this.getActiveLocations()
    const todayMovements = this.getTodayMovementsCount()

    // Calculate total cards in stock
    const totalCards = activeCards.reduce((sum, card) => sum + card.quantity, 0)

    // Calculate low stock cards
    const lowStockCards = activeCards.filter((card) => card.quantity <= card.minThreshold).length

    // Get active users count
    const activeUsers = this.getActiveUsers().length

    return {
      totalBanks: activeBanks.length,
      totalCardTypes: activeCards.length,
      totalLocations: activeLocations.length,
      todayMovements,
      totalCards,
      lowStockCards,
      activeUsers,
    }
  }

  getStatsByDateRange(
    dateFrom?: Date,
    dateTo?: Date,
  ): {
    totalBanks: number
    totalCardTypes: number
    totalLocations: number
    movements: number
    totalCards: number
    lowStockCards: number
    activeUsers: number
  } {
    const activeBanks = this.getActiveBanks()
    const activeCards = this.getCards()
    const activeLocations = this.getActiveLocations()
    const movements = this.getMovementsCountByDateRange(dateFrom, dateTo)

    // Calculate total cards in stock
    const totalCards = activeCards.reduce((sum, card) => sum + card.quantity, 0)

    // Calculate low stock cards
    const lowStockCards = activeCards.filter((card) => card.quantity <= card.minThreshold).length

    // Get active users count
    const activeUsers = this.getActiveUsers().length

    return {
      totalBanks: activeBanks.length,
      totalCardTypes: activeCards.length,
      totalLocations: activeLocations.length,
      movements,
      totalCards,
      lowStockCards,
      activeUsers,
    }
  }

  // These are no longer needed with the simplified card type system
}

export const dataStore = new DataStore()
