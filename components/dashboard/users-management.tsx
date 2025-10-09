"use client"

import { useState, useEffect } from "react"
import { useDataSync, useAutoRefresh } from "@/hooks/use-data-sync"
import { usePermissions } from "@/hooks/use-permissions"
import type { User, RolePermissions, UserFilters, Permission, Module, Action } from "@/lib/types"
import { getAuthHeaders } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"

// Liste des permissions disponibles
const ALL_PERMISSIONS: Permission[] = [
  "dashboard:view",
  "banks:view", "banks:create", "banks:update", "banks:delete", "banks:import", "banks:export", "banks:print",
  "cards:view", "cards:create", "cards:update", "cards:delete", "cards:import", "cards:export", "cards:print",
  "locations:view", "locations:create", "locations:update", "locations:delete", "locations:import", "locations:export", "locations:print",
  "movements:view", "movements:create", "movements:update", "movements:delete", "movements:import", "movements:export", "movements:print",
  "users:view", "users:create", "users:update", "users:delete", "users:import", "users:export", "users:print",
  "logs:view", "logs:create", "logs:update", "logs:delete", "logs:import", "logs:export", "logs:print",
  "config:view", "config:create", "config:update", "config:delete", "config:import", "config:export", "config:print"
]

export default function UsersManagement() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const [users, setUsers] = useState<User[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermissions[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false)
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RolePermissions | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)
  const [filters, setFilters] = useState<UserFilters>({
    role: "all",
    status: "all",
    searchTerm: "",
  })

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "viewer",
    password: "",
    sendEmail: false,
  })

  const [formErrors, setFormErrors] = useState<{
    email?: string
    firstName?: string
    lastName?: string
    password?: string
  }>({})

  const [roleFormData, setRoleFormData] = useState({
    role: "",
    description: "",
    permissions: [] as Permission[],
  })

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    try {
      // Charger les utilisateurs
      const params = new URLSearchParams()
      if (filters.role && filters.role !== 'all') params.append('role', filters.role)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.searchTerm) params.append('search', filters.searchTerm)
      
      const usersResponse = await fetch(`/api/users?${params.toString()}`)
      const usersData = await usersResponse.json()
      if (usersData.success) {
        setUsers(usersData.data || [])
      }

      // Charger les rôles
      const rolesResponse = await fetch('/api/roles')
      const rolesData = await rolesResponse.json()
      if (rolesData.success) {
        setRolePermissions(rolesData.data || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  useDataSync(["users", "roles"], loadData)
  useAutoRefresh(loadData, 120000) // 2 minutes

  const handleAddUser = async () => {
    const errors: {
      email?: string
      firstName?: string
      lastName?: string
      password?: string
    } = {}

    if (!formData.email || formData.email.trim() === "") {
      errors.email = "L'email est obligatoire"
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        errors.email = "Le format de l'email est invalide"
      }
    }

    if (!formData.firstName || formData.firstName.trim() === "") {
      errors.firstName = "Le prénom est obligatoire"
    }

    if (!formData.lastName || formData.lastName.trim() === "") {
      errors.lastName = "Le nom est obligatoire"
    }

    // Validation du mot de passe (optionnel mais s'il est fourni, il doit être valide)
    if (formData.password && formData.password.trim() !== "") {
      if (formData.password.length < 6) {
        errors.password = "Le mot de passe doit contenir au moins 6 caractères"
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          password: formData.password || undefined, // Utiliser le mot de passe fourni ou undefined pour génération automatique
          sendEmail: formData.sendEmail,
          isActive: true,
        })
      })

      const data = await response.json()
      if (!data.success) {
        alert(data.error || 'Erreur lors de la création')
        return
      }

      // Afficher le mot de passe généré si pas d'email envoyé
      if (!formData.sendEmail && data.generatedPassword) {
        alert(`Utilisateur créé avec succès !\n\nMot de passe généré: ${data.generatedPassword}\n\nVeuillez noter ce mot de passe et le communiquer à l'utilisateur.`)
      } else if (formData.sendEmail) {
        alert('Utilisateur créé avec succès ! Les informations de connexion ont été envoyées par email.')
      } else {
        alert('Utilisateur créé avec succès !')
      }

      setIsAddDialogOpen(false)
      resetForm()
      await loadData()
    } catch (error) {
      console.error('Error adding user:', error)
      alert('Erreur lors de la création')
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return

    const errors: {
      email?: string
      firstName?: string
      lastName?: string
    } = {}

    if (!formData.email || formData.email.trim() === "") {
      errors.email = "L'email est obligatoire"
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        errors.email = "Le format de l'email est invalide"
      }
    }

    if (!formData.firstName || formData.firstName.trim() === "") {
      errors.firstName = "Le prénom est obligatoire"
    }

    if (!formData.lastName || formData.lastName.trim() === "") {
      errors.lastName = "Le nom est obligatoire"
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
        })
      })

      const data = await response.json()
      if (!data.success) {
        alert(data.error || 'Erreur lors de la mise à jour')
        return
      }

      setIsEditDialogOpen(false)
      setSelectedUser(null)
      resetForm()
      await loadData()
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Erreur lors de la mise à jour')
    }
  }

  const handleToggleStatus = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId)
      if (!user) return

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          isActive: !user.isActive
        })
      })

      const data = await response.json()
      if (data.success) {
        await loadData()
      }
    } catch (error) {
      console.error('Error toggling user status:', error)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (confirm("Êtes-vous sûr de vouloir désactiver cet utilisateur ?")) {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'DELETE'
        })
        const data = await response.json()
        if (data.success) {
          await loadData()
        } else {
          alert(data.error || 'Erreur lors de la suppression')
        }
      } catch (error) {
        console.error('Error deleting user:', error)
        alert('Erreur lors de la suppression')
      }
    }
  }

  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      password: "",
      sendEmail: false,
    })
    setFormErrors({})
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      role: "viewer",
      password: "",
      sendEmail: false,
    })
    setFormErrors({})
  }

  const handleAddRole = async () => {
    if (!roleFormData.role || !roleFormData.description) {
      alert("Veuillez remplir tous les champs obligatoires")
      return
    }

    if (roleFormData.permissions.length === 0) {
      alert("Veuillez sélectionner au moins une permission")
      return
    }

    if (rolePermissions.some((r) => r.role.toLowerCase() === roleFormData.role.toLowerCase())) {
      alert("Un rôle avec ce nom existe déjà")
      return
    }

    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role: roleFormData.role,
          description: roleFormData.description,
          permissions: roleFormData.permissions,
          isCustom: true,
        })
      })

      const data = await response.json()
      if (!data.success) {
        alert(data.error || 'Erreur lors de la création du rôle')
        return
      }

      setIsAddRoleDialogOpen(false)
      resetRoleForm()
      await loadData()
    } catch (error) {
      console.error('Error creating role:', error)
      alert('Erreur lors de la création du rôle')
    }
  }

  const handleEditRole = async () => {
    if (!selectedRole) return

    if (!roleFormData.role || !roleFormData.description) {
      alert("Veuillez remplir tous les champs obligatoires")
      return
    }

    if (roleFormData.permissions.length === 0) {
      alert("Veuillez sélectionner au moins une permission")
      return
    }

    setIsUpdatingRole(true)
    try {
      // Pour les rôles système, ne pas envoyer le nom du rôle
      const updateData: any = {
        description: roleFormData.description,
        permissions: roleFormData.permissions,
      }
      
      // Seulement envoyer le nom du rôle s'il s'agit d'un rôle personnalisé
      if (selectedRole.isCustom) {
        updateData.role = roleFormData.role
      }

      const response = await fetch(`/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      })

      const data = await response.json()
      if (!data.success) {
        alert(data.error || 'Erreur lors de la mise à jour du rôle')
        return
      }

      setIsEditRoleDialogOpen(false)
      setSelectedRole(null)
      resetRoleForm()
      
      // Attendre un petit délai puis recharger les données
      setTimeout(async () => {
        await loadData()
        setIsUpdatingRole(false)
      }, 100)
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Erreur lors de la mise à jour du rôle')
      setIsUpdatingRole(false)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    const role = rolePermissions.find((r) => r.id === roleId)
    if (!role) return

    if (!role.isCustom) {
      alert("Impossible de supprimer un rôle prédéfini")
      return
    }

    const usersWithRole = users.filter((u) => u.role === role.role)
    if (usersWithRole.length > 0) {
      alert(`Impossible de supprimer ce rôle car ${usersWithRole.length} utilisateur(s) l'utilisent`)
      return
    }

    if (confirm(`Êtes-vous sûr de vouloir supprimer le rôle "${role.role}" ?`)) {
      try {
        const response = await fetch(`/api/roles/${roleId}`, {
          method: 'DELETE'
        })

        const data = await response.json()
        if (!data.success) {
          alert(data.error || 'Erreur lors de la suppression du rôle')
          return
        }

        await loadData()
      } catch (error) {
        console.error('Error deleting role:', error)
        alert('Erreur lors de la suppression du rôle')
      }
    }
  }

  const openEditRoleDialog = (role: RolePermissions) => {
    setSelectedRole(role)
    setRoleFormData({
      role: role.role,
      description: role.description,
      permissions: [...role.permissions],
    })
    setIsEditRoleDialogOpen(true)
  }

  const resetRoleForm = () => {
    setRoleFormData({
      role: "",
      description: "",
      permissions: [],
    })
  }

  const togglePermission = (permission: Permission) => {
    setRoleFormData((prev) => {
      const permissions = prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission]
      return { ...prev, permissions }
    })
  }

  const toggleModulePermissions = (module: Module, enable: boolean) => {
    const actions: Action[] = ["create", "read", "update", "delete"]
    const modulePermissions = actions
      .map((action) => `${module}:${action}` as Permission)
      .filter((perm) => ALL_PERMISSIONS.includes(perm))

    setRoleFormData((prev) => {
      let permissions = [...prev.permissions]
      if (enable) {
        modulePermissions.forEach((perm) => {
          if (!permissions.includes(perm)) {
            permissions.push(perm)
          }
        })
      } else {
        permissions = permissions.filter((p) => !modulePermissions.includes(p))
      }
      return { ...prev, permissions }
    })
  }

  const hasAllModulePermissions = (module: Module): boolean => {
    const actions: Action[] = ["create", "read", "update", "delete"]
    const modulePermissions = actions
      .map((action) => `${module}:${action}` as Permission)
      .filter((perm) => ALL_PERMISSIONS.includes(perm))

    return modulePermissions.every((perm) => roleFormData.permissions.includes(perm))
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default"
      case "manager":
        return "secondary"
      case "operator":
        return "outline"
      default:
        return "outline"
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Super Admin"
      case "manager":
        return "Admin"
      case "operator":
        return "Opérateur"
      case "viewer":
        return "Utilisateur"
      default:
        return role
    }
  }

  const getModuleLabel = (module: Module): string => {
    const labels: Record<Module, string> = {
      banks: "Banques",
      cards: "Cartes",
      locations: "Emplacements",
      movements: "Mouvements",
      users: "Utilisateurs",
      reports: "Rapports",
      dashboard: "Tableau de bord",
      config: "Configuration",
      logs: "Journaux",
    }
    return labels[module]
  }

  const getActionLabel = (action: Action): string => {
    const labels: Record<Action, string> = {
      create: "Créer",
      read: "Consulter",
      update: "Modifier",
      delete: "Supprimer",
      view: "Voir",
      import: "Importer",
      export: "Exporter",
      print: "Imprimer",
    }
    return labels[action]
  }

  const organizePermissionsByModule = (permissions: Permission[]) => {
    const modules: Module[] = ["banks", "cards", "locations", "movements", "users", "reports", "dashboard", "config", "logs"]
    const organized: Record<Module, Action[]> = {
      banks: [],
      cards: [],
      locations: [],
      movements: [],
      users: [],
      reports: [],
      dashboard: [],
      config: [],
      logs: [],
    }

    permissions.forEach((permission) => {
      const [module, action] = permission.split(":") as [Module, Action]
      if (organized[module]) {
        organized[module].push(action)
      }
    })

    return organized
  }

  const allPermissions = ALL_PERMISSIONS
  const modules: Module[] = ["banks", "cards", "locations", "movements", "users", "reports", "dashboard", "config"]

  return (
    <div className="space-y-6">
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="permissions">Rôles et Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Gestion des Utilisateurs</h2>
              <p className="text-sm text-slate-600">Gérez les utilisateurs et leurs droits d'accès</p>
            </div>
            {hasPermission('users', 'create') && (
              <Button
                onClick={() => {
                  resetForm()
                  setIsAddDialogOpen(true)
                }}
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un utilisateur
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filtres</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Recherche</Label>
                  <Input
                    placeholder="Nom, prénom, email..."
                    value={filters.searchTerm}
                    onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Rôle</Label>
                  <Select value={filters.role} onValueChange={(value) => setFilters({ ...filters, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les rôles</SelectItem>
                      {rolePermissions.map((rp) => (
                        <SelectItem key={rp.id} value={rp.role}>
                          {getRoleLabel(rp.role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters({ ...filters, status: value as UserFilters["status"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="active">Actifs</SelectItem>
                      <SelectItem value="inactive">Inactifs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Liste des utilisateurs ({users.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date de création</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {hasPermission('users', 'update') && (
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                            Modifier
                          </Button>
                        )}
                        {hasPermission('users', 'update') && (
                          <Button
                            variant={user.isActive ? "outline" : "default"}
                            size="sm"
                            onClick={() => handleToggleStatus(user.id)}
                          >
                            {user.isActive ? "Désactiver" : "Activer"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Rôles et Permissions</h2>
              <p className="text-sm text-slate-600">
                Chaque rôle dispose de permissions spécifiques pour accéder aux différentes fonctionnalités
              </p>
            </div>
            {hasPermission('users', 'create') && (
              <Button onClick={() => setIsAddRoleDialogOpen(true)}>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Créer un rôle
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rolePermissions.map((rolePermission) => {
              const organizedPerms = organizePermissionsByModule(rolePermission.permissions)
              return (
                <Card key={rolePermission.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getRoleLabel(rolePermission.role)}
                        {rolePermission.isCustom && <Badge variant="outline">Personnalisé</Badge>}
                      </div>
                      <Badge variant={getRoleBadgeVariant(rolePermission.role)}>
                        {rolePermission.permissions.length} permissions
                      </Badge>
                    </CardTitle>
                    <CardDescription>{rolePermission.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold">Permissions par module :</Label>
                        <div className="space-y-3 mt-3">
                          {modules.map((module) => {
                            const actions = organizedPerms[module]
                            if (actions.length === 0) return null
                            return (
                              <div key={module} className="border-l-2 border-slate-200 pl-3">
                                <div className="font-medium text-sm text-slate-900">{getModuleLabel(module)}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {actions.map((action) => (
                                    <Badge key={action} variant="secondary" className="text-xs">
                                      {getActionLabel(action)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        {hasPermission('users', 'update') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-transparent"
                            onClick={() => openEditRoleDialog(rolePermission)}
                          >
                            Modifier
                          </Button>
                        )}
                        {hasPermission('users', 'delete') && rolePermission.isCustom && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleDeleteRole(rolePermission.id)}
                          >
                            Supprimer
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
            <DialogDescription>Créez un nouveau compte utilisateur avec un rôle spécifique</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value })
                  if (formErrors.email) {
                    setFormErrors({ ...formErrors, email: undefined })
                  }
                }}
                className={formErrors.email ? "border-red-500" : ""}
                placeholder="utilisateur@example.com"
              />
              {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => {
                    setFormData({ ...formData, firstName: e.target.value })
                    if (formErrors.firstName) {
                      setFormErrors({ ...formErrors, firstName: undefined })
                    }
                  }}
                  className={formErrors.firstName ? "border-red-500" : ""}
                  placeholder="Jean"
                />
                {formErrors.firstName && <p className="text-sm text-red-500 mt-1">{formErrors.firstName}</p>}
              </div>
              <div>
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => {
                    setFormData({ ...formData, lastName: e.target.value })
                    if (formErrors.lastName) {
                      setFormErrors({ ...formErrors, lastName: undefined })
                    }
                  }}
                  className={formErrors.lastName ? "border-red-500" : ""}
                  placeholder="Dupont"
                />
                {formErrors.lastName && <p className="text-sm text-red-500 mt-1">{formErrors.lastName}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="role">Rôle *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rolePermissions.map((rp) => (
                    <SelectItem key={rp.id} value={rp.role}>
                      {getRoleLabel(rp.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="password">Mot de passe (optionnel)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value })
                  if (formErrors.password) {
                    setFormErrors({ ...formErrors, password: undefined })
                  }
                }}
                className={formErrors.password ? "border-red-500" : ""}
                placeholder="Laissez vide pour générer automatiquement"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Si vide, un mot de passe temporaire sera généré automatiquement
              </p>
              {formErrors.password && <p className="text-sm text-red-500 mt-1">{formErrors.password}</p>}
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="sendEmail"
                checked={formData.sendEmail}
                onCheckedChange={(checked) => setFormData({ ...formData, sendEmail: checked })}
              />
              <Label htmlFor="sendEmail">Envoyer les informations de connexion par email</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddUser}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>Modifiez les informations de l'utilisateur</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value })
                  if (formErrors.email) {
                    setFormErrors({ ...formErrors, email: undefined })
                  }
                }}
                className={formErrors.email ? "border-red-500" : ""}
              />
              {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-firstName">Prénom *</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={(e) => {
                    setFormData({ ...formData, firstName: e.target.value })
                    if (formErrors.firstName) {
                      setFormErrors({ ...formErrors, firstName: undefined })
                    }
                  }}
                  className={formErrors.firstName ? "border-red-500" : ""}
                />
                {formErrors.firstName && <p className="text-sm text-red-500 mt-1">{formErrors.firstName}</p>}
              </div>
              <div>
                <Label htmlFor="edit-lastName">Nom *</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={(e) => {
                    setFormData({ ...formData, lastName: e.target.value })
                    if (formErrors.lastName) {
                      setFormErrors({ ...formErrors, lastName: undefined })
                    }
                  }}
                  className={formErrors.lastName ? "border-red-500" : ""}
                />
                {formErrors.lastName && <p className="text-sm text-red-500 mt-1">{formErrors.lastName}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="edit-role">Rôle *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rolePermissions.map((rp) => (
                    <SelectItem key={rp.id} value={rp.role}>
                      {getRoleLabel(rp.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleEditUser}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddRoleDialogOpen} onOpenChange={setIsAddRoleDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un rôle</DialogTitle>
            <DialogDescription>Créez un nouveau rôle personnalisé avec des permissions spécifiques</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="role-name">Nom du rôle *</Label>
              <Input
                id="role-name"
                value={roleFormData.role}
                onChange={(e) => setRoleFormData({ ...roleFormData, role: e.target.value })}
                placeholder="Ex: Gestionnaire de stock"
                disabled={selectedRole ? !selectedRole.isCustom : false}
              />
              {selectedRole && !selectedRole.isCustom && (
                <p className="text-sm text-slate-500 mt-1">
                  Le nom des rôles système ne peut pas être modifié
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="role-description">Description *</Label>
              <Textarea
                id="role-description"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                placeholder="Décrivez les responsabilités de ce rôle"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-3 block">Permissions par module *</Label>
              <div className="space-y-4 border rounded-lg p-4">
                {modules.map((module) => {
                  const actions: Action[] = ["create", "read", "update", "delete"]
                  const availableActions = actions.filter((action) =>
                    allPermissions.includes(`${module}:${action}` as Permission),
                  )
                  if (availableActions.length === 0) return null

                  return (
                    <div key={module} className="border-b last:border-b-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-semibold text-slate-900">{getModuleLabel(module)}</Label>
                        <Checkbox
                          checked={hasAllModulePermissions(module)}
                          onCheckedChange={(checked) => toggleModulePermissions(module, checked as boolean)}
                        />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-4">
                        {availableActions.map((action) => {
                          const permission = `${module}:${action}` as Permission
                          return (
                            <div key={permission} className="flex items-center space-x-2">
                              <Checkbox
                                id={`perm-${permission}`}
                                checked={roleFormData.permissions.includes(permission)}
                                onCheckedChange={() => togglePermission(permission)}
                              />
                              <Label htmlFor={`perm-${permission}`} className="text-sm font-normal cursor-pointer">
                                {getActionLabel(action)}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRoleDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddRole}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              {selectedRole?.isCustom
                ? "Modifiez les informations et permissions de ce rôle personnalisé"
                : "Modifiez les permissions de ce rôle prédéfini"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-role-name">Nom du rôle *</Label>
              <Input
                id="edit-role-name"
                value={roleFormData.role}
                onChange={(e) => setRoleFormData({ ...roleFormData, role: e.target.value })}
                disabled={!selectedRole?.isCustom}
              />
            </div>
            <div>
              <Label htmlFor="edit-role-description">Description *</Label>
              <Textarea
                id="edit-role-description"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-3 block">Permissions par module *</Label>
              <div className="space-y-4 border rounded-lg p-4">
                {modules.map((module) => {
                  const actions: Action[] = ["create", "read", "update", "delete"]
                  const availableActions = actions.filter((action) =>
                    allPermissions.includes(`${module}:${action}` as Permission),
                  )
                  if (availableActions.length === 0) return null

                  return (
                    <div key={module} className="border-b last:border-b-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-semibold text-slate-900">{getModuleLabel(module)}</Label>
                        <Checkbox
                          checked={hasAllModulePermissions(module)}
                          onCheckedChange={(checked) => toggleModulePermissions(module, checked as boolean)}
                        />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-4">
                        {availableActions.map((action) => {
                          const permission = `${module}:${action}` as Permission
                          return (
                            <div key={permission} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-perm-${permission}`}
                                checked={roleFormData.permissions.includes(permission)}
                                onCheckedChange={() => togglePermission(permission)}
                              />
                              <Label htmlFor={`edit-perm-${permission}`} className="text-sm font-normal cursor-pointer">
                                {getActionLabel(action)}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRoleDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleEditRole} disabled={isUpdatingRole}>
              {isUpdatingRole ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
