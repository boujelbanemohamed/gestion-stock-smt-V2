# 📝 Guide du Système de Logging Automatique

## ✅ Système implémenté avec succès !

Le système de logging automatique enregistre **toutes les actions importantes** dans la base de données PostgreSQL pour assurer une **traçabilité complète**.

---

## 🎯 Ce qui est actuellement loggé

### ✅ Authentification (`/api/auth/login`)
- ✅ Connexions réussies
- ✅ Tentatives échouées (mauvais mot de passe)
- ✅ Tentatives échouées (utilisateur inconnu)
- ✅ Tentatives échouées (compte désactivé)

### ✅ Mouvements (`/api/movements`)
- ✅ Création de mouvements (Entrée, Sortie, Transfert)

---

## 📦 Structure du système

### 1. **Fonction utilitaire** : `lib/audit-logger.ts`
```typescript
import { logAudit } from "@/lib/audit-logger"

await logAudit({
  userId: user.id,
  userEmail: user.email,
  action: "create",  // create, update, delete, login, logout, view
  module: "banks",   // banks, cards, locations, movements, users, config
  entityType: "bank",
  entityId: bank.id,
  entityName: bank.name,
  details: "Création d'une nouvelle banque",
  status: "success",  // success, failure
  errorMessage: null  // En cas d'erreur
}, request)
```

### 2. **Table PostgreSQL** : `audit_logs`
- `id` : Identifiant unique
- `timestamp` : Date/heure de l'action
- `userId` : ID de l'utilisateur
- `userEmail` : Email de l'utilisateur
- `action` : Type d'action (create, update, delete, login, logout, view)
- `module` : Module concerné (banks, cards, locations, movements, users, config)
- `entityType` : Type d'entité (bank, card, location, movement, user)
- `entityId` : ID de l'entité affectée
- `entityName` : Nom de l'entité
- `details` : Détails de l'action
- `ipAddress` : Adresse IP de l'utilisateur
- `userAgent` : Navigateur utilisé
- `status` : Statut (success, failure)
- `errorMessage` : Message d'erreur éventuel

---

## 🔧 Comment ajouter le logging à d'autres routes API

### Exemple : API Banks

#### 1. **Importer la fonction** :
```typescript
import { logAudit } from "@/lib/audit-logger"
```

#### 2. **POST - Création d'une banque** :
```typescript
const newBank = await prisma.bank.create({ /* ... */ })

// Logger la création
await logAudit({
  userId: body.createdBy || "system",
  userEmail: body.createdByEmail || "system@monetique.tn",
  action: "create",
  module: "banks",
  entityType: "bank",
  entityId: newBank.id,
  entityName: newBank.name,
  details: `Création de la banque: ${newBank.name} (${newBank.code})`,
  status: "success"
}, request)
```

#### 3. **PUT - Modification d'une banque** :
```typescript
const updatedBank = await prisma.bank.update({ /* ... */ })

// Logger la modification
await logAudit({
  userId: body.updatedBy || "system",
  userEmail: body.updatedByEmail || "system@monetique.tn",
  action: "update",
  module: "banks",
  entityType: "bank",
  entityId: updatedBank.id,
  entityName: updatedBank.name,
  details: `Modification de la banque: ${updatedBank.name}`,
  status: "success"
}, request)
```

#### 4. **DELETE - Suppression d'une banque** :
```typescript
const deletedBank = await prisma.bank.delete({ /* ... */ })

// Logger la suppression
await logAudit({
  userId: body.deletedBy || "system",
  userEmail: body.deletedByEmail || "system@monetique.tn",
  action: "delete",
  module: "banks",
  entityType: "bank",
  entityId: deletedBank.id,
  entityName: deletedBank.name,
  details: `Suppression de la banque: ${deletedBank.name}`,
  status: "success"
}, request)
```

#### 5. **Gestion des erreurs** :
```typescript
try {
  const newBank = await prisma.bank.create({ /* ... */ })
  await logAudit({ /* ... success ... */ }, request)
} catch (error) {
  // Logger l'échec
  await logAudit({
    userId: body.createdBy || "system",
    userEmail: body.createdByEmail || "system@monetique.tn",
    action: "create",
    module: "banks",
    entityType: "bank",
    details: `Échec de création d'une banque`,
    status: "failure",
    errorMessage: error.message
  }, request)
  
  // Retourner l'erreur
  return NextResponse.json(...)
}
```

---

## 🔍 Routes API à instrumenter

### ✅ Déjà instrumentées
- `/api/auth/login` ✅
- `/api/movements` (POST) ✅

### 📋 À instrumenter
- `/api/banks` (POST, PUT, DELETE)
- `/api/banks/[id]` (PUT, DELETE)
- `/api/cards` (POST, PUT, DELETE)
- `/api/cards/[id]` (PUT, DELETE)
- `/api/locations` (POST, PUT, DELETE)
- `/api/locations/[id]` (PUT, DELETE)
- `/api/users` (POST, PUT, DELETE)
- `/api/users/[id]` (PUT, DELETE)
- `/api/config` (PUT)
- `/api/roles` (POST, PUT, DELETE)
- `/api/roles/[id]` (PUT, DELETE)

---

## 📊 Visualisation des logs

### Dashboard
Les logs s'affichent automatiquement sur le dashboard dans la section **"Activité récente"**.

### Page Logs
Accédez à `/dashboard/logs` pour voir l'historique complet avec filtres :
- Par utilisateur
- Par module
- Par action
- Par statut
- Par date

### API
```bash
# Récupérer tous les logs
GET /api/logs

# Filtrer par module
GET /api/logs?module=banks

# Filtrer par action
GET /api/logs?action=create

# Filtrer par statut
GET /api/logs?status=failure

# Filtrer par date
GET /api/logs?dateFrom=2025-01-01T00:00:00Z&dateTo=2025-12-31T23:59:59Z

# Limiter le nombre de résultats
GET /api/logs?limit=50
```

---

## 🧪 Tester le système

### 1. **Test de connexion réussie** :
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@monetique.tn", "password": "password123"}'
```

### 2. **Test de connexion échouée** :
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@monetique.tn", "password": "wrongpassword"}'
```

### 3. **Vérifier les logs en base** :
```bash
psql postgresql://mohamed:password@localhost:5432/stock_management \
  -c "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10;"
```

### 4. **Vérifier via l'API** :
```bash
curl http://localhost:3000/api/logs?limit=10
```

---

## ✅ Avantages du système

1. **Traçabilité complète** : Qui a fait quoi et quand
2. **Sécurité** : Détection des tentatives de connexion suspectes
3. **Audit** : Conformité réglementaire et rapports
4. **Debugging** : Facilite le diagnostic des problèmes
5. **Persistance** : Toutes les données sont stockées en base PostgreSQL
6. **Performance** : Les logs ne bloquent pas les opérations principales

---

## 🔒 Bonnes pratiques

1. ✅ **Toujours logger** les actions sensibles (création, modification, suppression)
2. ✅ **Logger les échecs** pour détecter les tentatives malveillantes
3. ✅ **Inclure les détails** pertinents sans exposer d'informations sensibles
4. ✅ **Ne pas logger** les mots de passe ou tokens
5. ✅ **Utiliser try/catch** pour que les erreurs de logging ne cassent pas l'application

---

## 📝 Exemple complet : Ajouter le logging à `/api/banks`

Voir les fichiers :
- `/app/api/auth/login/route.ts` (exemple complet avec gestion d'erreurs)
- `/app/api/movements/route.ts` (exemple de logging après création)

---

**Le système de logging est maintenant opérationnel ! 🎉**

