# Tables RedHat - Configuration Finale ✅

## 📊 Noms Exacts des Tables sur RedHat

Selon votre PgAdmin :

| Modèle Prisma | Table PostgreSQL RedHat | @@map() dans schema.prisma | Status |
|---------------|-------------------------|----------------------------|--------|
| `User` | **Users** | `@@map("Users")` | ✅ Configuré |
| `Bank` | **Banks** | `@@map("Banks")` | ✅ Configuré |
| `Card` | **Cards** | `@@map("Cards")` | ✅ Configuré |
| `Movement` | **Movements** | `@@map("Movements")` | ✅ Configuré |
| `AuditLog` | **Audit_logs** | `@@map("Audit_logs")` | ✅ Configuré |

---

## ⚠️ Tables à Vérifier sur RedHat

Ces tables devraient aussi exister sur votre serveur. Vérifiez avec :

```bash
sudo -u postgres psql stock_management -c "\dt"
```

**Tables probables :**
- `Locations` ou `Location` ?
- `StockLevels` ou `Stock_levels` ?
- `Notifications` ou `Notification` ?
- `RolePermissions` ou `Role_permissions` ?
- `AppConfig` ?

---

## 🔍 Commande de Vérification Complète

Sur votre serveur RedHat :

```bash
# Lister TOUTES les tables avec leurs noms EXACTS
sudo -u postgres psql stock_management -c "
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"
```

**Notez les noms EXACTS** et comparez avec le schéma Prisma :

```bash
cat prisma/schema.prisma | grep "@@map"
```

---

## ✅ Configuration Actuelle du Schéma Prisma

```prisma
model User { @@map("Users") }
model Bank { @@map("Banks") }
model Card { @@map("Cards") }
model Location { @@map("Locations") }
model Movement { @@map("Movements") }
model StockLevel { @@map("StockLevels") }
model RolePermission { @@map("RolePermissions") }
model Notification { @@map("Notifications") }
model AuditLog { @@map("Audit_logs") }  ← Underscore !
model AppConfig { @@map("AppConfig") }
```

---

## 🔧 Si D'autres Tables Ont des Underscores

**Vérifiez si vous avez :**
- `Stock_levels` au lieu de `StockLevels` ?
- `Role_permissions` au lieu de `RolePermissions` ?

**Si oui, il faudra adapter le schéma Prisma.**

**Commande pour vérifier :**

```bash
# Sur RedHat
sudo -u postgres psql stock_management -c "
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%_%'
ORDER BY tablename;
"
```

**Résultat attendu :**
```
 tablename   
-------------
 Audit_logs
```

**S'il y en a d'autres (ex: Stock_levels), envoyez-moi la liste !**

---

## 🚀 Prochaines Étapes

### 1. Vérification sur RedHat

```bash
# Connexion
ssh root@serveur-redhat

# Navigation
cd /var/www/stock-management-V2

# Récupérer les corrections
git pull origin main

# Lister VOS tables EXACTES
sudo -u postgres psql stock_management -c "\dt"
```

**📝 Notez tous les noms de tables et envoyez-les moi.**

---

### 2. Si Tout Correspond

Si les noms correspondent au schéma Prisma actuel :

```bash
# Déploiement direct
./deploy.sh
```

---

### 3. Si D'autres Underscores

Si vous voyez d'autres tables avec underscores (ex: `Stock_levels`), **dites-le moi** et je corrigerai le schéma avant le déploiement.

---

## 📋 Tables Vérifiées

### Confirmées par Vous ✅

- [x] **Users** → Schéma Prisma : `@@map("Users")` ✓
- [x] **Banks** → Schéma Prisma : `@@map("Banks")` ✓
- [x] **Cards** → Schéma Prisma : `@@map("Cards")` ✓
- [x] **Movements** → Schéma Prisma : `@@map("Movements")` ✓
- [x] **Audit_logs** → Schéma Prisma : `@@map("Audit_logs")` ✓

### À Vérifier sur RedHat

- [ ] **Locations** ou autre nom ?
- [ ] **StockLevels** ou **Stock_levels** ?
- [ ] **Notifications** ou autre nom ?
- [ ] **RolePermissions** ou **Role_permissions** ?
- [ ] **AppConfig** ou autre nom ?

---

## 🎯 Commande Simple

**Pour voir TOUTES vos tables sur RedHat :**

```bash
sudo -u postgres psql stock_management -c "\dt"
```

**Envoyez-moi le résultat complet !**

---

## ✅ État Actuel

**Modifications poussées sur GitHub (commit `7b205ea`) :**
- ✅ Schéma Prisma adapté pour : Users, Banks, Cards, Movements, Audit_logs
- ✅ Script deploy.sh utilise "Audit_logs"
- ✅ Script test-logs-production.sh utilise "Audit_logs"

**Prêt pour le déploiement dès que vous confirmez les autres noms de tables !** 🚀

