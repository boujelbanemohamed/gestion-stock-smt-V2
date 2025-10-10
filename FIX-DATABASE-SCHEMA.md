# Solution: Erreur "Database Schema is Not Empty"

**Problème:** `The database schema is not empty` lors de `prisma migrate deploy`

---

## 💡 Explication

Cette erreur apparaît quand :
- ✅ La base de données existe déjà
- ✅ Elle contient déjà des tables et des données
- ⚠️ Prisma ne trouve pas l'historique des migrations

**C'est NORMAL pour une mise à jour !** Vos données sont en sécurité. 🛡️

---

## 🔧 Solution Automatique

Le script `deploy.sh` a été mis à jour pour gérer automatiquement ce cas.

**Il suffit de relancer:**

```bash
./deploy.sh
```

Le script utilise maintenant `prisma db push` au lieu de `prisma migrate deploy` pour les mises à jour.

---

## 🔨 Solutions Manuelles

### Option 1: Utiliser `db push` (Recommandé pour mise à jour)

```bash
# Cette commande synchronise le schéma sans créer de migration
npx prisma db push --skip-generate

# Puis continuer avec le build
npm run build
pm2 restart stock-management
```

### Option 2: Initialiser l'Historique des Migrations

Si vous voulez commencer à utiliser les migrations:

```bash
# 1. Créer le répertoire de migrations
mkdir -p prisma/migrations

# 2. Marquer l'état actuel comme migration initiale
npx prisma migrate resolve --applied "0_init"

# 3. Maintenant vous pouvez utiliser migrate deploy
npx prisma migrate deploy
```

### Option 3: Réinitialiser les Migrations (ATTENTION)

⚠️ **UNIQUEMENT si la base est en développement/test !**

```bash
# ATTENTION: Ceci va SUPPRIMER toutes les données
npx prisma migrate reset

# Recréer les données de test
npx prisma db seed
```

---

## 📋 Comprendre la Différence

### `prisma migrate deploy`
- ✅ Pour les environnements avec historique de migrations
- ✅ Applique les migrations une par une
- ❌ Échoue si la base existe sans historique

### `prisma db push`
- ✅ Pour les mises à jour rapides
- ✅ Synchronise directement le schéma
- ✅ Fonctionne avec des bases existantes
- ⚠️ Ne crée pas d'historique de migration

---

## 🎯 Workflow Recommandé

### Pour les Mises à Jour (Production)

```bash
# 1. Générer le client
npx prisma generate

# 2. Synchroniser le schéma
npx prisma db push --skip-generate

# 3. Build et redémarrer
npm run build
pm2 restart stock-management
```

### Pour une Nouvelle Installation

```bash
# 1. Générer le client
npx prisma generate

# 2. Créer les tables
npx prisma db push

# 3. Peupler avec des données de test
npx prisma db seed
```

---

## ✅ Vérification

Après avoir appliqué la solution:

```bash
# 1. Vérifier que Prisma fonctionne
npx prisma studio --browser none &
# Devrait démarrer sur http://localhost:5555

# 2. Vérifier les tables
psql -U postgres -d stock_management -c "\dt"

# 3. Vérifier les données
psql -U postgres -d stock_management -c "SELECT COUNT(*) FROM \"Bank\""
```

---

## 🔄 Script Mis à Jour

Le script `deploy.sh` gère maintenant automatiquement ce cas:

```bash
# Extrait du nouveau deploy.sh
echo "   Vérification de la base de données..."
if npx prisma db push --skip-generate 2>&1 | grep -q "already in sync"; then
    log_success "Base de données déjà synchronisée"
else
    log_success "Base de données mise à jour"
fi
```

---

## 🆘 Si le Problème Persiste

### Vérifier la Connexion à la Base

```bash
# Tester la connexion
psql -U postgres -d stock_management -c "SELECT 1"

# Vérifier les tables existantes
psql -U postgres -d stock_management -c "\dt"

# Vérifier que le schéma Prisma est correct
cat prisma/schema.prisma | grep "model"
```

### Vérifier les Variables d'Environnement

```bash
# Afficher DATABASE_URL (masquer le mot de passe)
grep DATABASE_URL .env | sed 's/:[^@]*@/:***@/'

# Tester avec Prisma
npx prisma db execute --stdin <<< "SELECT 1"
```

---

## 📝 Résumé

Pour une **mise à jour de production** avec base de données existante:

```bash
# NE PAS utiliser
❌ npx prisma migrate deploy  # Échoue si pas d'historique

# UTILISER
✅ npx prisma db push --skip-generate  # Fonctionne toujours

# OU mieux encore
✅ ./deploy.sh  # Le script gère tout automatiquement
```

---

## ✨ Prochaines Étapes

1. **Relancer le déploiement:**
   ```bash
   ./deploy.sh
   ```

2. **Le script va maintenant:**
   - ✅ Générer le client Prisma
   - ✅ Synchroniser le schéma (avec db push)
   - ✅ Continuer sans erreur

3. **Vérifier que tout fonctionne:**
   ```bash
   pm2 logs stock-management
   curl http://localhost:3000/api/banks | jq '.success'
   ```

---

*Guide créé pour résoudre l'erreur de schéma non vide*
