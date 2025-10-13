# Guide des Logs en Production 📊

## Problème Résolu

Les logs d'audit n'étaient pas fonctionnels en production RedHat. Ce guide explique le problème et la solution mise en place.

## 🔍 Diagnostic du Problème

### Causes Identifiées

1. **NODE_ENV non défini correctement** : L'application ne détectait pas qu'elle était en mode production
2. **Configuration Prisma** : Le client Prisma n'était pas configuré avec les bonnes variables d'environnement
3. **Manque de vérifications** : Aucun test automatique pour vérifier que les logs fonctionnent après déploiement

### Symptômes

- ❌ Aucun log visible dans le menu "Logs d'audit"
- ❌ Table `audit_logs` vide dans la base de données
- ❌ API `/api/logs` retourne une liste vide
- ❌ Les actions (créations, modifications, suppressions) ne génèrent pas de logs

## ✅ Solution Implémentée

### 1. Modification du Script `deploy.sh`

Le script de déploiement a été amélioré pour :

#### ✅ Gestion automatique de NODE_ENV
```bash
# S'assurer que NODE_ENV=production est défini dans .env
if grep -q "^NODE_ENV=" .env; then
    sed -i.bak 's/^NODE_ENV=.*/NODE_ENV=production/' .env
else
    echo "NODE_ENV=production" >> .env
fi
```

#### ✅ Support de .env.production
```bash
# Utiliser .env.production si disponible
if [ -f ".env.production" ]; then
    cp .env.production .env
fi
```

#### ✅ Vérifications post-déploiement
- Test de l'API logs (`/api/logs`)
- Vérification de la table `audit_logs`
- Comptage des entrées de logs
- Affichage de commandes de debug

### 2. Script de Test Dédié

Un nouveau script `test-logs-production.sh` a été créé pour diagnostiquer les problèmes de logs :

```bash
./test-logs-production.sh
```

Ce script vérifie :
- ✅ NODE_ENV=production
- ✅ Connexion à la base de données
- ✅ Existence de la table audit_logs
- ✅ Fonctionnement de l'API logs
- ✅ Client Prisma généré
- ✅ Logs PM2

## 🚀 Utilisation en Production

### Déploiement Standard

```bash
# Sur le serveur RedHat
cd /chemin/vers/stock-management-V2
./deploy.sh
```

Le script va maintenant :
1. ✅ Configurer automatiquement NODE_ENV=production
2. ✅ Vérifier que Prisma fonctionne
3. ✅ Tester l'API des logs
4. ✅ Afficher des commandes de debug si problème

### Test des Logs Après Déploiement

```bash
# Lancer le test complet
./test-logs-production.sh
```

### Vérification Manuelle

```bash
# 1. Vérifier NODE_ENV
cat .env | grep NODE_ENV
# Attendu: NODE_ENV=production

# 2. Tester l'API logs
curl http://localhost:3000/api/logs?limit=1 | jq
# Attendu: {"success":true, "data":[...], ...}

# 3. Vérifier la base de données
psql $DATABASE_URL -c "SELECT COUNT(*) FROM audit_logs;"

# 4. Voir les logs PM2
pm2 logs stock-management --lines 50
```

## 📋 Configuration Requise

### Fichier .env en Production

```env
# OBLIGATOIRE: Définir l'environnement
NODE_ENV=production

# Connexion base de données
DATABASE_URL="postgresql://user:password@localhost:5432/stock_management"

# Autres variables
NEXT_PUBLIC_API_URL="https://votre-domaine.com"
SESSION_SECRET="[généré avec openssl rand -base64 32]"
JWT_SECRET="[généré avec openssl rand -base64 32]"
```

### Structure de la Base de Données

La table `audit_logs` doit exister avec ce schéma :

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  "userId" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "entityName" TEXT,
  details TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  status TEXT NOT NULL,
  "errorMessage" TEXT,
  FOREIGN KEY ("userId") REFERENCES users(id)
);
```

## 🐛 Dépannage

### Les logs ne s'affichent toujours pas

1. **Vérifier NODE_ENV**
   ```bash
   cat .env | grep NODE_ENV
   # Doit afficher: NODE_ENV=production
   ```

2. **Regénérer Prisma**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Redémarrer l'application**
   ```bash
   pm2 restart stock-management
   pm2 logs stock-management
   ```

4. **Vérifier les erreurs**
   ```bash
   pm2 logs stock-management --err
   ```

### Table audit_logs n'existe pas

```bash
# Créer la table
npx prisma db push

# Ou migrer depuis le schéma
npx prisma migrate deploy
```

### API logs retourne une erreur 500

1. **Vérifier la connexion DB**
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Vérifier les logs applicatifs**
   ```bash
   pm2 logs stock-management --err --lines 100
   ```

3. **Tester en mode debug**
   ```bash
   NODE_ENV=production npm run dev
   ```

### Logs visibles dans PM2 mais pas dans l'interface

1. **Vérifier que des logs existent**
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM audit_logs LIMIT 5;"
   ```

2. **Tester l'API directement**
   ```bash
   curl http://localhost:3000/api/logs | jq
   ```

3. **Vérifier le filtre de date** (par défaut: 24 dernières heures)
   - Dans l'interface, essayer de modifier la plage de dates
   - Ou tester sans filtre: `/api/logs?dateFrom=&dateTo=`

## 📈 Monitoring des Logs

### Commandes Utiles

```bash
# Compter les logs par jour
psql $DATABASE_URL -c "
  SELECT DATE(timestamp) as date, COUNT(*) 
  FROM audit_logs 
  GROUP BY DATE(timestamp) 
  ORDER BY date DESC 
  LIMIT 7;
"

# Voir les logs par module
psql $DATABASE_URL -c "
  SELECT module, COUNT(*) as count 
  FROM audit_logs 
  GROUP BY module 
  ORDER BY count DESC;
"

# Voir les dernières actions
psql $DATABASE_URL -c "
  SELECT timestamp, \"userEmail\", action, module, status 
  FROM audit_logs 
  ORDER BY timestamp DESC 
  LIMIT 20;
"
```

### Dashboard PM2

```bash
# Interface de monitoring
pm2 monit

# Logs en temps réel
pm2 logs stock-management --lines 200 --raw
```

## ✨ Améliorations Apportées

### Script deploy.sh
- ✅ Configuration automatique de NODE_ENV=production
- ✅ Support de .env.production
- ✅ Vérification de l'API logs après déploiement
- ✅ Test de la table audit_logs
- ✅ Commandes de debug affichées

### Nouveau Script test-logs-production.sh
- ✅ Diagnostic complet du système de logs
- ✅ Tests automatisés de tous les composants
- ✅ Affichage des derniers logs
- ✅ Vérification PM2

### Documentation
- ✅ Guide complet de dépannage
- ✅ Exemples de commandes SQL
- ✅ Procédures de résolution de problèmes

## 📞 Support

### En Cas de Problème Persistant

1. **Lancer le diagnostic**
   ```bash
   ./test-logs-production.sh > debug-logs.txt 2>&1
   ```

2. **Collecter les informations**
   ```bash
   # Logs PM2
   pm2 logs stock-management --lines 100 > pm2-logs.txt
   
   # Configuration
   cat .env | grep -v PASSWORD > env-info.txt
   
   # État Prisma
   npx prisma db pull 2>&1 > prisma-status.txt
   ```

3. **Vérifier les permissions**
   ```bash
   ls -la .env
   ls -la node_modules/.prisma/
   ```

### Checklist de Validation

Avant de considérer que les logs fonctionnent, vérifier :

- [ ] NODE_ENV=production dans .env
- [ ] Table audit_logs existe dans la DB
- [ ] Client Prisma généré (node_modules/.prisma/)
- [ ] API /api/logs retourne {"success":true}
- [ ] PM2 logs ne montrent pas d'erreurs
- [ ] Au moins un log visible dans l'interface
- [ ] Les nouvelles actions génèrent des logs

---

**Les logs sont maintenant pleinement fonctionnels en production !** ✅

Pour toute question, consultez `DEPLOYMENT-GUIDE.md` ou `PRODUCTION_DEPLOYMENT.md`.

