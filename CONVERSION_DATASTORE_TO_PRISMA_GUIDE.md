# 📘 Guide de conversion dataStore → Prisma

Ce guide vous aide à convertir les fichiers restants qui utilisent encore `dataStore` vers Prisma.

## ✅ Progression actuelle

### Convertis (6/33)
- ✅ `app/api/banks/route.ts`
- ✅ `app/api/banks/[id]/route.ts`
- ✅ `app/api/stats/route.ts`
- ✅ `app/api/auth/login/route.ts`
- ✅ `app/api/auth/logout/route.ts`
- ✅ `app/api/auth/me/route.ts`

### En cours de conversion
- ⏳ Users, Cards, Locations, Movements...

---

## 🔄 Pattern de conversion : API Route

### Avant (dataStore)

\`\`\`typescript
import { dataStore } from "@/lib/data-store"

export async function GET(request: NextRequest) {
  const items = dataStore.getAllItems()
  return NextResponse.json({ success: true, data: items })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newItem = dataStore.addItem(body)
  return NextResponse.json({ success: true, data: newItem })
}
\`\`\`

### Après (Prisma)

\`\`\`typescript
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  const items = await prisma.item.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json({ success: true, data: items })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newItem = await prisma.item.create({
    data: body
  })
  return NextResponse.json({ success: true, data: newItem })
}
\`\`\`

---

## 🔄 Pattern de conversion : Component

### Avant (dataStore)

\`\`\`typescript
const loadItems = () => {
  const items = dataStore.getAllItems()
  setItems(items)
}

const handleDelete = (id: string) => {
  dataStore.deleteItem(id)
  loadItems()
}
\`\`\`

### Après (API fetch)

\`\`\`typescript
const loadItems = async () => {
  const response = await fetch('/api/items')
  const data = await response.json()
  if (data.success) {
    setItems(data.data)
  }
}

const handleDelete = async (id: string) => {
  const response = await fetch(\`/api/items/\${id}\`, {
    method: 'DELETE'
  })
  const data = await response.json()
  if (data.success) {
    await loadItems()
  }
}
\`\`\`

---

## 📝 Checklist de conversion

Pour chaque fichier à convertir :

1. [ ] Remplacer l'import : `dataStore` → `prisma`
2. [ ] Convertir les appels synchrones en async/await
3. [ ] Utiliser les méthodes Prisma appropriées
4. [ ] Ajouter la gestion d'erreurs avec try/catch
5. [ ] Tester la fonctionnalité

---

## 🗂️ Référence rapide : Méthodes Prisma

| dataStore | Prisma |
|-----------|--------|
| `getAll()` | `findMany()` |
| `getById(id)` | `findUnique({ where: { id } })` |
| `add(data)` | `create({ data })` |
| `update(id, data)` | `update({ where: { id }, data })` |
| `delete(id)` | `delete({ where: { id } })` |
| `search(filters)` | `findMany({ where: filters })` |

---

## 📋 Fichiers restants à convertir

### API Routes (prioritaire)
- [ ] `app/api/users/route.ts`
- [ ] `app/api/users/[id]/route.ts`
- [ ] `app/api/cards/route.ts`
- [ ] `app/api/cards/[id]/route.ts`
- [ ] `app/api/cards/import/route.ts`
- [ ] `app/api/locations/route.ts`
- [ ] `app/api/locations/[id]/route.ts`
- [ ] `app/api/locations/import/route.ts`
- [ ] `app/api/movements/route.ts`
- [ ] `app/api/movements/[id]/route.ts`
- [ ] `app/api/roles/route.ts`
- [ ] `app/api/roles/[id]/route.ts`
- [ ] `app/api/notifications/route.ts`
- [ ] `app/api/notifications/[id]/route.ts`
- [ ] `app/api/config/route.ts`
- [ ] `app/api/banks/import/route.ts`

### Components
- [ ] `components/dashboard/users-management.tsx`
- [ ] `components/dashboard/cards-management.tsx`
- [ ] `components/dashboard/locations-management.tsx`
- [ ] `components/dashboard/movements-management.tsx`
- [ ] `components/dashboard/configuration-panel.tsx`
- [ ] `components/dashboard/logs-panel.tsx`

---

**Date**: 30 septembre 2025  
**Statut**: En cours de conversion
