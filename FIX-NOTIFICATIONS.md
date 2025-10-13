# Fix : Système de Notifications 🔔

## Problème Détecté

Le système de notifications était **partiellement fonctionnel** avec un problème critique dans l'implémentation.

---

## 🔍 Diagnostic

### Symptômes Observés

1. **Requêtes Fréquentes** 📡
   - Le client faisait des appels API toutes les 30 secondes
   - Visible dans les logs : `GET /api/notifications?userId=xxx 200 in 11ms`
   - Nombreuses requêtes mais aucune notification affichée

2. **API Non Fonctionnelle** ❌
   ```typescript
   export async function GET(request: NextRequest) {
     // Pour l'instant, retourner un tableau vide
     return NextResponse.json<ApiResponse<any[]>>({
       success: true,
       data: [],  // ❌ TOUJOURS VIDE !
     })
   }
   ```

3. **Composant Client Configuré** ✅
   - Polling toutes les 30 secondes configuré
   - Interface utilisateur complète
   - Fonctionnalités : marquer comme lu, supprimer, etc.

### Analyse

**Ce qui fonctionnait :**
- ✅ Composant React (`components/notifications.tsx`)
- ✅ Table Prisma (`Notification`)
- ✅ Helper functions (`lib/notification-helper.ts`)
- ✅ API individuelle (`app/api/notifications/[id]/route.ts`)

**Ce qui ne fonctionnait PAS :**
- ❌ API principale (`app/api/notifications/route.ts`)
- ❌ Récupération des notifications depuis la DB
- ❌ Création de nouvelles notifications via API

---

## ✅ Solution Implémentée

### 1. API GET - Récupération des Notifications

**Avant :**
```typescript
export async function GET(request: NextRequest) {
  try {
    // Retourne toujours []
    return NextResponse.json<ApiResponse<any[]>>({
      success: true,
      data: [],
    })
  }
}
```

**Après :**
```typescript
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const unreadOnly = searchParams.get("unreadOnly") === "true"

    const where: any = {}
    
    // Notifications globales OU spécifiques à l'utilisateur
    if (userId) {
      where.OR = [
        { userId: null },  // Pour tous
        { userId: userId }  // Pour cet utilisateur
      ]
    } else {
      where.userId = null
    }

    if (unreadOnly) {
      where.isRead = false
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json<ApiResponse<Notification[]>>({
      success: true,
      data: notifications as Notification[],
    })
  }
}
```

**Améliorations :**
- ✅ Récupération depuis Prisma
- ✅ Support notifications globales (userId = null)
- ✅ Support notifications spécifiques utilisateur
- ✅ Filtre non lues optionnel
- ✅ Tri par date décroissante
- ✅ Limite à 50 notifications

### 2. API POST - Création de Notifications

**Ajout :**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const notification = await prisma.notification.create({
      data: {
        type: body.type || "info",
        title: body.title,
        message: body.message,
        userId: body.userId || null,
        isRead: false,
      },
    })

    return NextResponse.json<ApiResponse<Notification>>({
      success: true,
      data: notification as Notification,
      message: "Notification créée avec succès",
    }, { status: 201 })
  }
}
```

**Fonctionnalités :**
- ✅ Création de notifications via API
- ✅ Support types : info, warning, error, success
- ✅ Notifications globales ou individuelles

---

## 🎯 Résultats

### Test de l'API

```bash
# Récupérer les notifications d'un utilisateur
curl http://localhost:3000/api/notifications?userId=xxx

# Réponse:
{
  "success": true,
  "data": [
    {
      "id": "cmg8in5m90008i66eism4q0j0",
      "type": "success",
      "title": "Test notification",
      "message": "Ceci est une notification de test",
      "userId": "cmg89g74700031dord82bctw5",
      "isRead": true,
      "createdAt": "2025-10-01T21:46:10.354Z"
    },
    {
      "id": "cmg89g74m00141dor5hdtoo3z",
      "type": "warning",
      "title": "Stock faible",
      "message": "Le stock de cartes Mastercard Standard est faible",
      "userId": "cmg89g74700031dord82bctw5",
      "isRead": false,
      "createdAt": "2025-10-01T17:28:49.175Z"
    }
  ]
}
```

### Vérification

- ✅ API retourne les vraies notifications
- ✅ Notifications existantes visibles
- ✅ Tri chronologique inverse (les plus récentes d'abord)
- ✅ Status isRead correct
- ✅ Types de notifications respectés

---

## 🚀 Fonctionnalités du Système

### Types de Notifications

| Type | Icône | Couleur | Usage |
|------|-------|---------|-------|
| **info** | ℹ️ | Bleu | Informations générales |
| **success** | ✅ | Vert | Actions réussies |
| **warning** | ⚠️ | Jaune | Alertes non critiques |
| **error** | ❌ | Rouge | Erreurs critiques |

### Notifications Automatiques

Via `notification-helper.ts` :

1. **Stock Faible** 📦
   ```typescript
   createLowStockNotification(cardName, currentStock, threshold, userId)
   ```

2. **Nouveaux Mouvements** 📊
   ```typescript
   createMovementNotification(movementType, cardName, quantity, userId)
   ```

3. **Activité Utilisateur** 👤
   ```typescript
   createUserActivityNotification(action, entityType, entityName, userId)
   ```

4. **Notifications Système** 🔔
   ```typescript
   createSystemNotification(title, message)
   // userId = null → visible par tous
   ```

### Actions Utilisateur

Dans l'interface (composant) :

- ✅ **Voir notifications** : Icône cloche + badge compteur
- ✅ **Marquer comme lue** : Bouton sur chaque notification
- ✅ **Tout marquer comme lu** : Bouton global
- ✅ **Supprimer** : Bouton rouge sur chaque notification
- ✅ **Refresh auto** : Toutes les 30 secondes
- ✅ **Scroll** : Liste scrollable (max 50 notifications)

---

## 📋 Utilisation

### Créer une Notification Globale

```bash
# Via API
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "type": "info",
    "title": "Maintenance planifiée",
    "message": "Le système sera en maintenance demain de 2h à 4h",
    "userId": null
  }'
```

### Créer une Notification Individuelle

```bash
# Via API
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "type": "warning",
    "title": "Action requise",
    "message": "Veuillez valider votre profil",
    "userId": "user-id-123"
  }'
```

### Via Code (Helper)

```typescript
import { createNotification, createLowStockNotification } from "@/lib/notification-helper"

// Notification générale
await createNotification({
  type: "success",
  title: "Déploiement réussi",
  message: "La version 2.0 a été déployée avec succès"
})

// Stock faible
await createLowStockNotification("Visa Gold", 5, 10, userId)

// Résultat : Notification créée et visible pour l'utilisateur
```

---

## 🔄 Intégration avec les Modules

### Recommandations d'Intégration

Pour activer les notifications automatiques, ajouter dans les APIs :

#### 1. API Movements

```typescript
// app/api/movements/route.ts
import { createMovementNotification } from "@/lib/notification-helper"

export async function POST(request: NextRequest) {
  // ... création du mouvement
  
  // Notifier
  await createMovementNotification(
    movement.movementType,
    card.name,
    movement.quantity,
    movement.userId
  )
}
```

#### 2. Vérification Stock

```typescript
// Après chaque mouvement, vérifier le stock
const stockLevel = await prisma.stockLevel.findUnique({
  where: { locationId_cardId: { locationId, cardId } }
})

if (stockLevel && stockLevel.quantity < threshold) {
  await createLowStockNotification(
    card.name,
    stockLevel.quantity,
    threshold,
    userId
  )
}
```

#### 3. Actions Utilisateur

```typescript
// app/api/users/route.ts
import { createUserActivityNotification } from "@/lib/notification-helper"

export async function POST(request: NextRequest) {
  const user = await prisma.user.create({ data })
  
  // Notifier les admins
  await createUserActivityNotification(
    "Création",
    "utilisateur",
    `${user.firstName} ${user.lastName}`,
    adminUserId
  )
}
```

---

## 🎨 Interface Utilisateur

### Composant

Le composant `NotificationsDropdown` affiche :

```
┌─────────────────────────────────┐
│ 🔔 Notifications     [Tout lire]│
├─────────────────────────────────┤
│ ⚠️ Stock faible            •    │
│    Le stock de Mastercard...    │
│    Il y a 2h    [Lu] [Supprimer]│
├─────────────────────────────────┤
│ ✅ Test notification            │
│    Ceci est une notification... │
│    Il y a 12 jours  [Supprimer] │
└─────────────────────────────────┘
```

**Caractéristiques :**
- Badge rouge avec compteur de non lues
- Icône selon le type
- Fond bleu pour non lues
- Point bleu pour non lues
- Actions contextuelles
- Scroll pour > 10 notifications

---

## 📊 Performance

### Polling Actuel

- **Fréquence** : 30 secondes
- **Impact** : Faible (requêtes légères)
- **Limite** : 50 notifications par requête

### Améliorations Futures Possibles

1. **WebSocket** pour notifications temps réel
2. **Server-Sent Events** pour push notifications
3. **Pagination** pour > 50 notifications
4. **Cache** pour réduire les requêtes DB

---

## ✅ Checklist de Validation

Vérifier que :

- [x] API GET retourne les notifications
- [x] API POST crée des notifications
- [x] Notifications globales fonctionnent (userId = null)
- [x] Notifications individuelles fonctionnent
- [x] Marquer comme lu fonctionne
- [x] Suppression fonctionne
- [x] Badge compteur s'affiche
- [x] Polling 30s actif
- [x] Interface responsive

---

## 📝 Fichiers Modifiés

| Fichier | Changement | Statut |
|---------|-----------|--------|
| `app/api/notifications/route.ts` | Implémentation complète GET + POST | ✅ Corrigé |
| `app/api/notifications/[id]/route.ts` | PUT + DELETE | ✅ Déjà OK |
| `components/notifications.tsx` | Composant client | ✅ Déjà OK |
| `lib/notification-helper.ts` | Helper functions | ✅ Déjà OK |

---

## 🎯 Résumé

| Aspect | Avant | Après |
|--------|-------|-------|
| **API GET** | Retourne [] | Retourne vraies notifications ✅ |
| **API POST** | N'existe pas | Crée notifications ✅ |
| **Polling** | Inutile ([] toujours) | Fonctionnel ✅ |
| **Notifications DB** | Non utilisées | Utilisées ✅ |
| **Interface** | Vide | Affiche les notifications ✅ |
| **Badge compteur** | Toujours 0 | Nombre correct ✅ |

---

**Le système de notifications est maintenant 100% fonctionnel !** 🎉

Les utilisateurs peuvent maintenant :
- ✅ Recevoir des notifications globales
- ✅ Recevoir des notifications personnelles
- ✅ Voir le compteur de non lues
- ✅ Marquer comme lues
- ✅ Supprimer des notifications
- ✅ Refresh automatique toutes les 30s

Pour activer les notifications automatiques, intégrer les appels au `notification-helper` dans les différentes APIs (movements, stock, users, etc.).

