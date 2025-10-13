# Guide du Système de Rollback 🔄

## Vue d'Ensemble

Le script `deploy.sh` intègre maintenant un **système de rollback automatique** qui restaure automatiquement l'application à son état précédent en cas d'échec du déploiement.

---

## 🛡️ Protection Automatique

### Fonctionnement

Le système de rollback se déclenche **automatiquement** dès qu'une erreur se produit pendant le déploiement :

1. ✅ **Sauvegarde préventive** : Avant le déploiement
   - Commit Git actuel sauvegardé
   - Backup de la base de données créé

2. ❌ **Détection d'erreur** : Si une étape échoue
   - Le rollback se déclenche immédiatement
   - Aucune intervention manuelle requise

3. 🔄 **Restauration automatique** : Retour à l'état stable
   - Code restauré au commit précédent
   - Application redémarrée avec l'ancienne version
   - Backup DB disponible si nécessaire

---

## 📋 Étapes de Sauvegarde

### Avant le Déploiement

```bash
# Le script sauvegarde automatiquement :
PREVIOUS_COMMIT=$(git rev-parse HEAD)
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
```

**Informations sauvegardées :**
- ✅ Hash du commit Git actuel
- ✅ Backup complet de la base de données
- ✅ Timestamp du déploiement

---

## 🔄 Processus de Rollback Automatique

### Déclenchement

Le rollback se déclenche si **n'importe quelle étape échoue** :
- ❌ `git pull` échoue
- ❌ `npm install` échoue
- ❌ `npx prisma generate` échoue
- ❌ `npm run build` échoue
- ❌ Redémarrage PM2 échoue
- ❌ Toute autre erreur

### Actions du Rollback

```bash
ROLLBACK EN COURS
==================

1️⃣ Restauration du commit précédent
   → git reset --hard $PREVIOUS_COMMIT

2️⃣ Réinstallation des dépendances
   → npm install

3️⃣ Regénération Prisma
   → npx prisma generate

4️⃣ Rebuild de l'ancienne version
   → NODE_ENV=production npm run build

5️⃣ Redémarrage de l'application
   → pm2 delete stock-management
   → pm2 start npm --name "stock-management" -- start
```

### Résultat

Après le rollback :
- ✅ Application restaurée à la version précédente
- ✅ Code au commit d'origine
- ✅ Application fonctionnelle
- ℹ️ Backup DB disponible pour restauration manuelle

---

## 🚀 Utilisation

### Déploiement Normal

```bash
./deploy.sh
```

**Si tout réussit :**
```
✅ Déploiement terminé avec succès !
📊 Résumé:
  - Commit précédent: abc123f
  - Nouveau commit: 6dc9849
  - Backup DB: backup_20251013_143022.sql
```

**Si une erreur survient :**
```
❌ ERREUR DÉTECTÉE - ROLLBACK EN COURS

1️⃣ Restauration du commit précédent... ✓
2️⃣ Réinstallation des dépendances... ✓
3️⃣ Regénération Prisma... ✓
4️⃣ Rebuild de l'ancienne version... ✓
5️⃣ Redémarrage de l'application... ✓

⚠️ ROLLBACK TERMINÉ

L'application a été restaurée à la version précédente
Commit restauré: abc123f
Backup DB disponible: backup_20251013_143022.sql
```

---

## 🔧 Rollback Manuel

### Restauration du Code

Si vous devez faire un rollback manuellement après un déploiement :

```bash
# Voir l'historique des commits
git log --oneline -5

# Restaurer un commit spécifique
git reset --hard <commit-hash>

# Exemple
git reset --hard abc123f

# Réinstaller et redémarrer
npm install
npx prisma generate
NODE_ENV=production npm run build
pm2 restart stock-management
```

### Restauration de la Base de Données

```bash
# Lister les backups disponibles
ls -lh backup_*.sql

# Restaurer un backup spécifique
psql -U postgres stock_management < backup_20251013_143022.sql

# Ou avec l'URL complète
psql "$DATABASE_URL" < backup_20251013_143022.sql
```

### Vérification Après Rollback

```bash
# Vérifier le commit actuel
git log --oneline -1

# Vérifier que l'application fonctionne
curl http://localhost:3000/api/logs?limit=1

# Voir les logs PM2
pm2 logs stock-management --lines 50

# Statut de l'application
pm2 status
```

---

## 📊 Scénarios de Rollback

### Scénario 1 : Échec du Build

```bash
# Lors du déploiement
npm run build
❌ ERREUR: Build échoué

# Rollback automatique se déclenche
→ Code restauré au commit précédent
→ Build avec l'ancienne version
→ Application redémarrée
✓ Rollback terminé
```

### Scénario 2 : Erreur Prisma

```bash
# Lors du déploiement
npx prisma db push
❌ ERREUR: Schéma incompatible

# Rollback automatique se déclenche
→ Code restauré
→ Prisma regénéré avec ancien schéma
→ Application redémarrée
✓ Rollback terminé
```

### Scénario 3 : Dépendances Incompatibles

```bash
# Lors du déploiement
npm install
❌ ERREUR: Conflit de dépendances

# Rollback automatique se déclenche
→ Code restauré
→ Anciennes dépendances réinstallées
→ Application redémarrée
✓ Rollback terminé
```

---

## 🛡️ Sécurité et Limitations

### Ce qui est Protégé

✅ **Code source** - Restauré automatiquement  
✅ **Dépendances npm** - Réinstallées  
✅ **Build Next.js** - Reconstruit  
✅ **Configuration Prisma** - Regénérée  
✅ **Processus PM2** - Redémarré  

### Ce qui N'est PAS Restauré Automatiquement

⚠️ **Base de données** - Backup disponible, restauration manuelle  
⚠️ **Fichiers uploadés** - Non concernés par le rollback code  
⚠️ **Configuration système** - Variables d'environnement, etc.  

### Pourquoi la DB n'est pas Restaurée Auto ?

La restauration automatique de la DB pourrait :
- ❌ Supprimer des données créées pendant le test
- ❌ Causer des pertes de données en production
- ❌ Être trop lente pour de grandes bases

**Solution :** Backup disponible pour restauration manuelle si nécessaire.

---

## 📝 Bonnes Pratiques

### Avant un Déploiement

1. **Tester localement**
   ```bash
   npm run build
   npm start
   ```

2. **Vérifier les logs**
   ```bash
   npm run lint
   npm test  # si des tests existent
   ```

3. **Backup manuel supplémentaire** (optionnel)
   ```bash
   pg_dump -U postgres stock_management > backup_manuel_$(date +%Y%m%d).sql
   ```

### Pendant le Déploiement

1. **Surveiller les logs**
   ```bash
   # Dans un autre terminal
   tail -f deploy.log  # si vous redirigez la sortie
   ```

2. **Ne pas interrompre**
   - Laisser le script terminer
   - Le rollback se déclenchera si nécessaire

### Après un Rollback

1. **Analyser la cause**
   ```bash
   # Voir les logs PM2
   pm2 logs stock-management --err --lines 100
   
   # Voir le dernier build
   cat .next/build-manifest.json
   ```

2. **Corriger le problème** en local
   
3. **Tester à nouveau**
   
4. **Re-déployer**

---

## 🔍 Diagnostic

### Vérifier l'État Actuel

```bash
# Commit actuel
git log --oneline -1

# Version de l'application
cat package.json | grep version

# Backups disponibles
ls -lh backup_*.sql | tail -5

# Application en cours
pm2 status
pm2 logs stock-management --lines 20
```

### Historique des Déploiements

```bash
# Historique Git
git log --oneline -10

# Backups créés
ls -lt backup_*.sql | head -10
```

---

## 🆘 Dépannage

### Le Rollback a Échoué

Si le rollback automatique échoue également :

```bash
# 1. Arrêter l'application
pm2 stop stock-management

# 2. Restaurer manuellement le code
git reset --hard <commit-precédent>

# 3. Nettoyer et réinstaller
rm -rf node_modules .next
npm install

# 4. Regénérer Prisma
npx prisma generate

# 5. Rebuild
NODE_ENV=production npm run build

# 6. Redémarrer
pm2 start stock-management
pm2 save
```

### Restaurer une Version Encore Plus Ancienne

```bash
# Voir l'historique
git log --oneline -20

# Restaurer un commit spécifique
git reset --hard <ancien-commit>

# Suivre les étapes de déploiement manuel
```

### Application Inaccessible Après Rollback

```bash
# Vérifier les logs
pm2 logs stock-management --err

# Redémarrer complètement
pm2 delete stock-management
NODE_ENV=production pm2 start npm --name "stock-management" -- start
pm2 save

# Tester
curl http://localhost:3000
```

---

## 📚 Commandes Utiles

### Gestion des Backups

```bash
# Lister tous les backups
ls -lh backup_*.sql

# Trier par date
ls -lt backup_*.sql

# Supprimer les vieux backups (>30 jours)
find . -name "backup_*.sql" -mtime +30 -delete

# Compresser les backups
gzip backup_*.sql

# Restaurer depuis un backup compressé
gunzip backup_20251013_143022.sql.gz
psql -U postgres stock_management < backup_20251013_143022.sql
```

### Gestion des Commits

```bash
# Voir l'historique détaillé
git log --oneline --graph --decorate

# Voir les différences entre deux commits
git diff <commit1> <commit2>

# Créer une branche de secours avant déploiement
git branch backup-$(date +%Y%m%d-%H%M%S)

# Lister les branches de secours
git branch | grep backup
```

---

## ✅ Checklist de Sécurité

Avant chaque déploiement :

- [ ] Tests locaux réussis
- [ ] Commit actuel noté (pour référence)
- [ ] Backup manuel créé (optionnel mais recommandé)
- [ ] Système de rollback activé dans deploy.sh
- [ ] Accès au serveur pour intervention si besoin
- [ ] Surveillance des logs pendant le déploiement

---

## 📞 Support

### En Cas de Problème Critique

1. **Arrêter l'application**
   ```bash
   pm2 stop stock-management
   ```

2. **Restaurer le dernier état stable connu**
   ```bash
   git reset --hard <dernier-commit-stable>
   npm install
   npx prisma generate
   NODE_ENV=production npm run build
   pm2 start stock-management
   ```

3. **Contacter l'équipe de support**

---

**Le système de rollback assure une sécurité maximale lors des déploiements !** 🛡️

Pour plus d'informations :
- `DEPLOY-NOW.md` - Guide de déploiement rapide
- `UPDATE-REDHAT-README.md` - Guide complet de mise à jour
- `DEPLOYMENT-GUIDE.md` - Documentation de déploiement

