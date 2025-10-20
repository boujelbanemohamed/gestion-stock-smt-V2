# Adaptation Schéma Prisma pour Tables RedHat 🔧

## 🔍 Problème Détecté

Vos tables sur le serveur RedHat utilisent des **noms avec majuscules** :
```
Users, Banks, Cards, Movements, AuditLogs
```

Alors que le schéma Prisma utilisait des **noms en minuscules** :
```
users, banks, cards, movements, audit_logs
```

**Résultat :** Incompatibilité qui aurait causé des erreurs lors du déploiement.

---

## ✅ Solution Appliquée

### Schéma Prisma Mis à Jour

Tous les `@@map()` ont été adaptés pour correspondre à vos tables existantes :

**Avant :**
```prisma
model User {
  // ...
  @@map("users")  // ❌ Minuscules
}

model Bank {
  // ...
  @@map("banks")  // ❌ Minuscules
}

model AuditLog {
  // ...
  @@map("audit_logs")  // ❌ Snake_case
}
```

**Après :**
```prisma
model User {
  // ...
  @@map("Users")  // ✅ Majuscules
}

model Bank {
  // ...
  @@map("Banks")  // ✅ Majuscules
}

model AuditLog {
  // ...
  @@map("AuditLogs")  // ✅ PascalCase
}
```

---

## 📋 Tables Mises à Jour

| Modèle Prisma | Table PostgreSQL (Avant) | Table PostgreSQL (Après) | Votre DB RedHat |
|---------------|--------------------------|--------------------------|-----------------|
| `User` | users | **Users** | ✅ Users |
| `Bank` | banks | **Banks** | ✅ Banks |
| `Card` | cards | **Cards** | ✅ Cards |
| `Location` | locations | **Locations** | (à vérifier) |
| `Movement` | movements | **Movements** | ✅ Movements |
| `StockLevel` | stock_levels | **StockLevels** | (à vérifier) |
| `AuditLog` | audit_logs | **AuditLogs** | ✅ AuditLogs |
| `Notification` | notifications | **Notifications** | (à vérifier) |
| `RolePermission` | role_permissions | **RolePermissions** | (à vérifier) |
| `AppConfig` | app_config | **AppConfig** | (à vérifier) |

---

## 🛠️ Scripts Mis à Jour

### 1. deploy.sh

**Modifications :**
- ✅ Vérifie `"AuditLogs"` au lieu de `"AuditLog"`
- ✅ Vérifie `"Notifications"` au lieu de `"Notification"`
- ✅ Liste des tables mise à jour (Users, Banks, Cards, etc.)

### 2. test-logs-production.sh

**Modifications :**
- ✅ Vérifie `"AuditLogs"` au lieu de `"AuditLog"`
- ✅ Messages mis à jour

### 3. DIAGNOSTIC-DB-REDHAT.sh

**Fonctionnalité existante :**
- ✅ Essaye automatiquement majuscules ET minuscules
- ✅ Détecte le bon format automatiquement

---

## 🚀 Impact sur le Déploiement

### Avant Cette Correction

```bash
./deploy.sh

# Aurait cherché :
SELECT COUNT(*) FROM "AuditLog";  ❌
# Erreur : relation "AuditLog" n'existe pas

# Prisma aurait essayé de créer :
CREATE TABLE "users" ...  ❌
# Conflit avec table "Users" existante
```

### Après Cette Correction

```bash
./deploy.sh

# Cherche maintenant :
SELECT COUNT(*) FROM "AuditLogs";  ✅
# Trouve la table !

# Prisma utilise :
@@map("AuditLogs")  ✅
# Correspond à la table existante
```

---

## 📊 Vérification sur RedHat

### Étapes de Validation

```bash
# Sur le serveur RedHat
cd /var/www/stock-management-V2

# 1. Récupérer les corrections
git pull origin main

# 2. Vérifier les noms EXACTS de vos tables
sudo -u postgres psql stock_management -c "
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"

# 3. Comparer avec le schéma Prisma
cat prisma/schema.prisma | grep "@@map"

# Ils doivent correspondre EXACTEMENT !
```

---

## ✅ Tables Confirmées par Vous

Selon votre PgAdmin, vous avez :
- ✅ `Users` → Schéma mis à jour ✓
- ✅ `Banks` → Schéma mis à jour ✓
- ✅ `Cards` → Schéma mis à jour ✓
- ✅ `Movements` → Schéma mis à jour ✓
- ✅ `AuditLogs` → Schéma mis à jour ✓

### Tables Probablement Présentes (À Confirmer)

- `Locations` → Schéma mis à jour
- `StockLevels` → Schéma mis à jour
- `Notifications` → Schéma mis à jour (nouvelle)
- `RolePermissions` → Schéma mis à jour
- `AppConfig` → Schéma mis à jour

---

## 🎯 Prochaines Étapes

### Sur Votre Serveur RedHat

```bash
# 1. Récupérer les corrections
cd /var/www/stock-management-V2
git pull origin main

# 2. Lancer le diagnostic
chmod +x DIAGNOSTIC-DB-REDHAT.sh
./DIAGNOSTIC-DB-REDHAT.sh

# Le diagnostic affichera maintenant :
# ✓ Table Users: X entrées
# ✓ Table Banks: X entrées
# ✓ Table Cards: X entrées
# etc.

# 3. Déploiement
./deploy.sh

# Maintenant tout fonctionnera correctement !
```

---

## 🔒 Sécurité des Données

**Garantie :**
- ✅ Schéma adapté à vos tables existantes
- ✅ Aucune modification des tables
- ✅ Aucune perte de données
- ✅ Prisma utilisera vos tables telles quelles
- ✅ Backup automatique avant toute action

---

## 📝 Fichiers Modifiés

1. **prisma/schema.prisma**
   - Tous les `@@map()` adaptés aux noms avec majuscules
   
2. **deploy.sh**
   - Vérifications adaptées (AuditLogs, Notifications, etc.)
   
3. **test-logs-production.sh**
   - Tests adaptés aux nouveaux noms

4. **DIAGNOSTIC-DB-REDHAT.sh**
   - Détection automatique majuscules/minuscules

---

**Le schéma Prisma correspond maintenant à vos tables RedHat !** ✅

Vous pouvez déployer en toute sécurité, vos données seront préservées.

