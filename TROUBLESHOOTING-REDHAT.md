# �� Guide de Dépannage - Red Hat

**Application:** stock-management  
**Dernier commit:** a1844e4  
**Date:** 10 Janvier 2025

---

## 🎯 Problèmes Courants et Solutions

### 1. ❌ Erreur: "fatal: detected dubious ownership in repository"

**Cause:** Git détecte un propriétaire différent du répertoire.

**Solution Rapide:**
```bash
cd /var/www/stock-management
git config --global --add safe.directory $(pwd)
git pull origin main
```

📖 **Guide complet:** `FIX-GIT-OWNERSHIP.md`

---

### 2. ❌ Erreur: "database schema is not empty"

**Cause:** Prisma migrate ne peut pas s'exécuter sur une base existante.

**Solution Rapide:**
```bash
cd /var/www/stock-management
npx prisma generate
npx prisma db push --skip-generate
npm run build
pm2 restart stock-management
```

📖 **Guide complet:** `FIX-DATABASE-SCHEMA.md`

---

### 3. ❌ Erreur: Page Logs retourne 404

**Cause:** Build non effectué après la mise à jour.

**Solution Rapide:**
```bash
cd /var/www/stock-management
rm -rf .next
npm run build
pm2 restart stock-management
```

📖 **Guide complet:** `FIX-404-LOGS.md`

---

### 4. ❌ Port 3000 Déjà Utilisé

**Cause:** Une autre instance tourne déjà.

**Solution:**
```bash
# Trouver le processus
sudo lsof -i :3000

# Tuer le processus (remplacer <PID> par le numéro)
sudo kill -9 <PID>

# Redémarrer
pm2 restart stock-management
```

---

### 5. ❌ Application Ne Démarre Pas

**Cause:** Dépendances manquantes ou erreurs de build.

**Solution:**
```bash
cd /var/www/stock-management

# Nettoyer complètement
rm -rf .next node_modules
npm cache clean --force

# Réinstaller
npm install
npx prisma generate

# Rebuild
npm run build

# Redémarrer
pm2 restart stock-management
```

---

### 6. ❌ Erreur de Connexion à PostgreSQL

**Cause:** Base de données non démarrée ou mauvaise configuration.

**Solution:**
```bash
# Vérifier PostgreSQL
sudo systemctl status postgresql

# Redémarrer si nécessaire
sudo systemctl restart postgresql

# Tester la connexion
psql -U postgres -d stock_management -c "SELECT 1"

# Vérifier le .env
cat .env | grep DATABASE_URL
```

---

### 7. ❌ PM2 Ne Trouve Pas l'Application

**Cause:** Application non enregistrée dans PM2.

**Solution:**
```bash
# Voir les applications PM2
pm2 list

# Si stock-management n'est pas là:
cd /var/www/stock-management
pm2 start npm --name "stock-management" -- start

# Sauvegarder
pm2 save

# Configurer le démarrage automatique
pm2 startup
```

---

### 8. ❌ Erreur "Cannot find module"

**Cause:** Dépendances non installées.

**Solution:**
```bash
cd /var/www/stock-management
npm install
npx prisma generate
pm2 restart stock-management
```

---

### 9. ❌ Page Blanche ou Erreur 500

**Cause:** Erreur JavaScript ou problème de build.

**Solution:**
```bash
# Voir les logs détaillés
pm2 logs stock-management --lines 100

# Rebuild complet
rm -rf .next
npm run build

# Vérifier les erreurs de build
npm run build 2>&1 | grep -i error

# Redémarrer
pm2 restart stock-management
```

---

### 10. ❌ Les Données Ne S'Affichent Pas

**Cause:** Problème de connexion à la base de données.

**Solution:**
```bash
# Vérifier la base de données
psql -U postgres -d stock_management

# Compter les enregistrements
SELECT 'Banks' as table, COUNT(*) FROM "Bank"
UNION ALL
SELECT 'Cards', COUNT(*) FROM "Card"
UNION ALL
SELECT 'Users', COUNT(*) FROM "User";

# Quitter
\q

# Vérifier l'API
curl http://localhost:3000/api/banks | jq '.data | length'
```

---

## 🔄 Solution Universelle

**Si vous ne savez pas quel est le problème exact:**

```bash
cd /var/www/stock-management

# 1. Sauvegarder la base
pg_dump -U postgres stock_management > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Récupérer le code
git fetch origin
git pull origin main

# 3. Nettoyer complètement
pm2 delete stock-management 2>/dev/null || true
rm -rf .next node_modules package-lock.json

# 4. Réinstaller
npm install
npx prisma generate

# 5. Rebuild
npm run build

# 6. Redémarrer
pm2 start npm --name "stock-management" -- start
pm2 save

# 7. Vérifier
sleep 5
pm2 logs stock-management --lines 30
curl -I http://localhost:3000
```

---

## 📊 Commandes de Diagnostic

```bash
# 1. État de l'application
pm2 status

# 2. Logs en temps réel
pm2 logs stock-management

# 3. Logs d'erreur uniquement
pm2 logs stock-management --err

# 4. Processus écoutant sur le port 3000
sudo lsof -i :3000

# 5. Espace disque
df -h

# 6. Mémoire
free -h

# 7. État PostgreSQL
sudo systemctl status postgresql

# 8. Test de l'API
curl http://localhost:3000/api/banks | jq '.'
```

---

## 🎯 Checklist de Vérification

Avant de demander de l'aide, vérifier:

- [ ] Git à jour: `git pull origin main` réussi
- [ ] Dépendances installées: `npm install` réussi
- [ ] Prisma généré: `npx prisma generate` réussi
- [ ] Build réussi: `npm run build` sans erreurs
- [ ] Application démarrée: `pm2 list` montre stock-management
- [ ] PostgreSQL actif: `sudo systemctl status postgresql`
- [ ] Fichier .env présent: `cat .env | grep DATABASE_URL`
- [ ] Port 3000 libre ou utilisé par stock-management
- [ ] Pas d'erreurs dans les logs: `pm2 logs stock-management`

---

## 📞 Support

### Ordre de Consultation

1. **QUICK-START-REDHAT.md** - Démarrage rapide
2. **FIX-*.md** - Solutions spécifiques aux erreurs
3. **DEPLOYMENT-GUIDE.md** - Guide complet
4. **Ce fichier** - Dépannage général

### Commandes Utiles

```bash
# Tout vérifier d'un coup
cd /var/www/stock-management && \
git log --oneline -1 && \
pm2 status && \
curl -I http://localhost:3000 && \
psql -U postgres -d stock_management -c "\dt"
```

---

## ✅ Après Résolution

Une fois le problème résolu:

```bash
# 1. Tester l'application
curl http://localhost:3000/dashboard/banks
curl http://localhost:3000/dashboard/logs
curl http://localhost:3000/api/banks | jq '.success'

# 2. Surveiller les logs
pm2 logs stock-management --lines 50

# 3. Tout fonctionne ? Sauvegarder !
pg_dump -U postgres stock_management > backup_working_$(date +%Y%m%d).sql
```

---

## 🚀 Script Automatisé

**Le plus simple:** Utiliser le script de déploiement qui gère tout automatiquement:

```bash
cd /var/www/stock-management
./deploy.sh
```

Le script gère automatiquement:
- ✅ Problème de propriétaire Git
- ✅ Schéma de base de données existant
- ✅ Backup automatique
- ✅ Build et redémarrage
- ✅ Vérifications

---

*Guide de dépannage complet - Dernière mise à jour: 10 Janvier 2025*
