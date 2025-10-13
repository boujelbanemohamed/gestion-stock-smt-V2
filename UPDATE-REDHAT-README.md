# Guide de Mise à Jour - Production RedHat 🚀

## Dernières Modifications (13 octobre 2025)

### ✅ Corrections et Améliorations

1. **Fix Logs Historiques** (commit e3684f5)
   - Période par défaut : 24h → 30 jours
   - Limite de chargement : 10 → 1000 logs
   - Support complet des filtres de dates
   - Correction nom de table : `audit_logs` → `AuditLog`

2. **Amélioration Système de Logs Production** (commit d1d23ff)
   - Configuration automatique NODE_ENV=production
   - Vérifications post-déploiement renforcées
   - Script de diagnostic : `test-logs-production.sh`
   - Documentation complète : `LOGS-PRODUCTION-GUIDE.md`

3. **Améliorations Bordereaux** (commit 130f0da)
   - Affichage nom + adresse banque dans bordereaux de sortie
   - Optimisation déploiement avec nettoyage cache
   - Récupération utilisateur depuis localStorage

## 🚀 Procédure de Mise à Jour

### Sur le Serveur RedHat

```bash
# 1. Se connecter au serveur
ssh votre-utilisateur@serveur-redhat

# 2. Naviguer vers le répertoire de l'application
cd /chemin/vers/stock-management-V2

# 3. Vérifier la branche actuelle
git branch

# 4. Exécuter le script de déploiement
./deploy.sh
```

### Ce que fait le script `deploy.sh` :

1. ✅ **Sécurité Git** : Configure le répertoire comme sûr
2. ✅ **Sauvegarde DB** : Crée un backup automatique
3. ✅ **Récupération** : `git pull origin main` (récupère tous les commits)
4. ✅ **Dépendances** : `npm install`
5. ✅ **Prisma** : Génération client + synchronisation DB
6. ✅ **Configuration** : Force NODE_ENV=production
7. ✅ **Cache** : Nettoyage `.next` et `node_modules/.cache`
8. ✅ **Build** : Production optimisé
9. ✅ **Redémarrage** : PM2 avec mode PRODUCTION
10. ✅ **Vérifications** : Tests API logs et base de données

## 🔍 Vérifications Post-Déploiement

### 1. Test Automatique des Logs

```bash
./test-logs-production.sh
```

**Ce que vérifie le script :**
- NODE_ENV=production ✓
- Connexion base de données ✓
- Table AuditLog présente ✓
- API logs fonctionnelle ✓
- Filtre 30 jours actif ✓
- Prisma généré ✓
- PM2 en cours d'exécution ✓

### 2. Vérifications Manuelles

```bash
# Vérifier NODE_ENV
cat .env | grep NODE_ENV
# Attendu: NODE_ENV=production

# Compter les logs dans la DB
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "AuditLog";'

# Tester l'API (30 derniers jours)
curl http://localhost:3000/api/logs?limit=1000 | jq '.total'

# Tester avec dates personnalisées
curl "http://localhost:3000/api/logs?dateFrom=2025-10-01" | jq '.total'

# Voir les logs PM2
pm2 logs stock-management --lines 50

# Statut de l'application
pm2 status
```

### 3. Test dans l'Interface Web

1. Ouvrir : `http://votre-domaine.com` (ou `http://localhost:3000`)
2. Se connecter avec vos identifiants
3. Menu : **Logs d'audit**
4. Vérifier :
   - Les logs des 30 derniers jours s'affichent
   - Les filtres de dates fonctionnent
   - Le nombre de logs correspond à la DB

## 📊 Commits Déployés

```
e3684f5 - fix: Logs historiques disparus (24h → 30 jours)
  • API: Filtre par défaut 30 jours
  • Interface: Limite 1000 logs
  • Support filtres dates
  • Fix nom table AuditLog

d1d23ff - fix: Correction système logs production RedHat
  • Config auto NODE_ENV=production
  • Vérifications post-déploiement
  • Script test-logs-production.sh
  • Documentation complète

130f0da - feat: Amélioration bordereaux + déploiement
  • Bordereaux: nom + adresse banque
  • Nettoyage cache Next.js
  • Build forcé en PRODUCTION
```

## 🔧 Résolution de Problèmes

### Les logs ne s'affichent pas

```bash
# 1. Vérifier que l'application tourne
pm2 status

# 2. Vérifier NODE_ENV
cat .env | grep NODE_ENV

# 3. Vérifier la table AuditLog
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "AuditLog";'

# 4. Regénérer Prisma
npx prisma generate
npx prisma db push

# 5. Redémarrer l'application
pm2 restart stock-management

# 6. Voir les erreurs
pm2 logs stock-management --err
```

### Erreur "Table audit_logs not found"

C'est normal si vous utilisez une ancienne version. La table s'appelle maintenant `AuditLog` (avec majuscule).

**Solution :**
```bash
# Vérifier dans Prisma
npx prisma db pull

# Vérifier les tables
psql $DATABASE_URL -c "\dt"

# La table doit être : AuditLog
```

### API retourne 0 logs alors que la DB en contient

Le filtre par défaut est maintenant de **30 jours**. Si vos logs sont plus anciens :

```bash
# Tester avec une date plus ancienne
curl "http://localhost:3000/api/logs?dateFrom=2025-09-01&limit=1000" | jq
```

## 📝 Fichiers Modifiés

### Scripts de Déploiement
- ✅ `deploy.sh` - Script principal mis à jour
- ✅ `test-logs-production.sh` - Diagnostic des logs

### API et Composants
- ✅ `app/api/logs/route.ts` - Filtre 30 jours
- ✅ `components/dashboard/logs-panel.tsx` - Limite 1000 logs

### Documentation
- ✅ `FIX-LOGS-HISTORIQUE.md` - Fix logs disparus
- ✅ `LOGS-PRODUCTION-GUIDE.md` - Guide complet logs
- ✅ `UPDATE-REDHAT-README.md` - Ce fichier

## 🎯 Checklist de Validation

Après le déploiement, vérifier :

- [ ] `git pull` a récupéré les derniers commits (e3684f5)
- [ ] NODE_ENV=production dans `.env`
- [ ] `npm install` a installé les dépendances
- [ ] Prisma client généré
- [ ] Build Next.js réussi
- [ ] PM2 a redémarré l'application
- [ ] Table `AuditLog` existe dans la DB
- [ ] API `/api/logs` fonctionne
- [ ] Interface web affiche les logs (30 jours)
- [ ] Filtres de dates opérationnels
- [ ] Pas d'erreurs dans `pm2 logs`

## 📞 Support

### Logs et Monitoring

```bash
# Logs applicatifs
pm2 logs stock-management

# Logs d'erreur uniquement
pm2 logs stock-management --err

# Logs Nginx
tail -f /var/log/nginx/stock-management-error.log

# Monitoring en temps réel
pm2 monit
```

### Documentation Complète

- `DEPLOYMENT-GUIDE.md` - Guide de déploiement
- `LOGS-PRODUCTION-GUIDE.md` - Guide système de logs
- `FIX-LOGS-HISTORIQUE.md` - Fix logs disparus
- `PRODUCTION_DEPLOYMENT.md` - Production avancée
- `TROUBLESHOOTING-REDHAT.md` - Dépannage RedHat

## ✅ Résumé des Changements

| Aspect | Avant | Après |
|--------|-------|-------|
| **Filtre logs par défaut** | 24 heures | 30 jours ✅ |
| **Limite chargement logs** | 10 | 1000 ✅ |
| **Nom table logs** | audit_logs | AuditLog ✅ |
| **Config NODE_ENV** | Manuelle | Automatique ✅ |
| **Vérification post-deploy** | Basique | Complète ✅ |
| **Bordereaux sortie** | Adresse seule | Nom + Adresse ✅ |
| **Cache Next.js** | Persistant | Nettoyé ✅ |
| **Script diagnostic** | Aucun | test-logs-production.sh ✅ |

---

**Mise à jour simplifiée, déploiement automatisé !** 🚀

Pour toute question, consultez la documentation ou lancez `./test-logs-production.sh` pour diagnostiquer.

