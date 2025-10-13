# 🚀 Déploiement Rapide - RedHat

## ✅ Tout est Prêt sur GitHub !

Toutes les modifications ont été poussées avec succès. Voici comment déployer sur votre serveur RedHat.

---

## 📦 Modifications Disponibles

**Commit actuel : `123f560`**

### Derniers Commits Déployables :

```
123f560 ← DERNIER - fix: Correction nom table AuditLog + scripts déploiement
e3684f5 - fix: Logs historiques disparus (24h → 30 jours)
d1d23ff - fix: Correction système logs production RedHat
130f0da - feat: Amélioration bordereaux + déploiement optimisé
```

---

## 🚀 Commandes de Déploiement

### Sur Votre Serveur RedHat

```bash
# 1. Connexion SSH
ssh votre-utilisateur@serveur-redhat

# 2. Navigation vers le projet
cd /chemin/vers/stock-management-V2

# 3. Déploiement automatique
./deploy.sh
```

**C'est tout !** Le script fait tout automatiquement :
- ✅ Backup base de données
- ✅ Sauvegarde commit actuel (rollback)
- ✅ Git pull (récupère commit 123f560)
- ✅ Installation dépendances
- ✅ Configuration NODE_ENV=production
- ✅ Build production
- ✅ Redémarrage PM2
- ✅ Vérifications complètes
- 🛡️ **Rollback automatique si erreur**

---

## 🔍 Vérification Rapide Après Déploiement

### Test Automatique

```bash
./test-logs-production.sh
```

### Test Manuel

```bash
# Vérifier le commit actuel
git log --oneline -1
# Attendu: 123f560

# Tester l'API des logs
curl http://localhost:3000/api/logs?limit=5 | jq '.total'

# Voir le statut PM2
pm2 status
```

---

## 📊 Améliorations Déployées

### 1. Logs Historiques Restaurés ✅
- **Avant** : Logs filtrés sur 24h (invisible)
- **Après** : Filtre par défaut 30 jours
- **Limite** : 1000 logs au lieu de 10

### 2. Scripts de Déploiement Corrigés ✅
- Table `audit_logs` → `AuditLog`
- Vérification filtre 30 jours
- Tests API automatiques

### 3. Bordereaux Améliorés ✅
- Nom + adresse banque affichés
- Meilleure présentation

### 4. Configuration Production ✅
- NODE_ENV automatique
- Nettoyage cache
- Build optimisé

---

## 📝 Checklist Post-Déploiement

- [ ] `./deploy.sh` exécuté sans erreur
- [ ] Application accessible (http://votre-domaine.com)
- [ ] Menu "Logs d'audit" affiche les logs
- [ ] Logs des 30 derniers jours visibles
- [ ] Pas d'erreurs dans `pm2 logs stock-management`

---

## 🛡️ Système de Rollback

Le script `deploy.sh` intègre un **rollback automatique** :

### Fonctionnement

Si une erreur survient pendant le déploiement :
1. ❌ L'erreur est détectée automatiquement
2. 🔄 Le rollback se déclenche immédiatement
3. ✅ L'application est restaurée à l'état précédent

### Ce qui est Restauré

- ✅ Code source (commit précédent)
- ✅ Dépendances npm
- ✅ Build Next.js
- ✅ Configuration Prisma
- ✅ Application PM2

### Rollback Manuel

Si besoin de revenir en arrière manuellement :

```bash
# Voir l'historique
git log --oneline -5

# Restaurer un commit
git reset --hard <commit-hash>

# Redéployer
npm install
npx prisma generate
NODE_ENV=production npm run build
pm2 restart stock-management
```

**Documentation complète :** `ROLLBACK-GUIDE.md`

---

## 🆘 En Cas de Problème

### Application ne démarre pas

```bash
pm2 logs stock-management --err
pm2 restart stock-management
```

### Logs ne s'affichent pas

```bash
./test-logs-production.sh
```

### Déploiement Échoué

Le rollback automatique restaure l'ancienne version.  
Consultez `ROLLBACK-GUIDE.md` pour plus de détails.

---

## 📚 Documentation Complète

Consultez ces fichiers pour plus de détails :

- **`ROLLBACK-GUIDE.md`** 🆕 - Guide système de rollback
- **`UPDATE-REDHAT-README.md`** - Guide complet de mise à jour
- **`LOGS-PRODUCTION-GUIDE.md`** - Guide système de logs
- **`FIX-LOGS-HISTORIQUE.md`** - Fix logs disparus
- **`DEPLOYMENT-GUIDE.md`** - Guide de déploiement général

---

## ✨ Résumé

**Tout est sur GitHub et prêt à déployer !**

1. SSH vers votre serveur RedHat
2. `cd /chemin/vers/stock-management-V2`
3. `./deploy.sh`
4. Vérifier dans le navigateur

**Bon déploiement !** 🎉

