# Guide de Déploiement - Serveur Red Hat

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Repository:** https://github.com/boujelbanemohamed/gestion-stock-smt-V2
**Branche:** main
**Dernier commit:** 7dfd383

---

## 📋 Informations du Repository

- **URL Git:** `https://github.com/boujelbanemohamed/gestion-stock-smt-V2.git`
- **Branche principale:** `main`
- **Dernier commit:** `7dfd383` - "docs: Ajout du changelog détaillé des modifications récentes"
- **Commits récents:** 11 commits documentés

---

## 🚀 Procédure de Déploiement Complète

### 1️⃣ Connexion au Serveur Red Hat

```bash
# Se connecter au serveur
ssh votre-utilisateur@votre-serveur-redhat

# Exemple:
ssh admin@192.168.1.100
```

### 2️⃣ Navigation vers le Projet

```bash
# Aller dans le répertoire du projet
cd /var/www/stock-management

# Ou selon votre configuration:
cd /opt/stock-management
# ou
cd /home/votre-utilisateur/stock-management
```

### 3️⃣ Sauvegarde de la Base de Données (IMPORTANT)

```bash
# Créer un backup avec timestamp
pg_dump -U postgres stock_management > backup_$(date +%Y%m%d_%H%M%S).sql

# Vérifier que le backup est créé
ls -lh backup_*.sql

# Optionnel: Compresser le backup
gzip backup_$(date +%Y%m%d_%H%M%S).sql
```

### 4️⃣ Récupération des Dernières Modifications

```bash
# Vérifier la branche actuelle
git branch

# Récupérer les dernières modifications depuis GitHub
git fetch origin

# Afficher les commits disponibles
git log origin/main --oneline -5

# Faire le pull depuis la branche main
git pull origin main

# Vérifier le commit actuel
git log --oneline -1
# Devrait afficher: 7dfd383 docs: Ajout du changelog détaillé des modifications récentes
```

### 5️⃣ Installation des Dépendances

```bash
# Installer les nouvelles dépendances npm
npm install

# Ou avec pnpm si vous l'utilisez:
# pnpm install
```

### 6️⃣ Configuration Prisma

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations de base de données
npx prisma migrate deploy

# Optionnel: Vérifier l'état de la base de données
npx prisma db pull
```

### 7️⃣ Variables d'Environnement

```bash
# Vérifier que le fichier .env existe et contient les bonnes informations
cat .env

# Le fichier doit contenir au minimum:
# DATABASE_URL="postgresql://utilisateur:motdepasse@localhost:5432/stock_management?schema=public"
# NODE_ENV=production
```

**Exemple de fichier .env pour production:**

```env
# Base de données
DATABASE_URL="postgresql://postgres:votre_mot_de_passe@localhost:5432/stock_management?schema=public"

# Environnement
NODE_ENV=production

# SMTP (optionnel pour l'envoi d'emails)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=votre_mot_de_passe_smtp
SMTP_FROM=noreply@example.com
```

### 8️⃣ Build de l'Application

```bash
# Builder l'application pour la production
npm run build

# Vérifier qu'il n'y a pas d'erreurs de build
echo $?
# Devrait retourner 0 si succès
```

### 9️⃣ Redémarrage du Service

#### Option A: Avec PM2

```bash
# Redémarrer l'application avec PM2
pm2 restart stock-management

# Vérifier le statut
pm2 status

# Voir les logs en temps réel
pm2 logs stock-management --lines 50

# Sauvegarder la configuration PM2
pm2 save
```

#### Option B: Avec systemd

```bash
# Redémarrer le service systemd
sudo systemctl restart stock-management

# Vérifier le statut
sudo systemctl status stock-management

# Voir les logs
sudo journalctl -u stock-management -f --lines 50
```

### 🔟 Vérification du Déploiement

```bash
# Vérifier que l'application répond
curl -I http://localhost:3000

# Ou avec l'URL publique
curl -I https://votre-domaine.com

# Vérifier les logs pour détecter d'éventuelles erreurs
pm2 logs stock-management --lines 100
# ou
sudo journalctl -u stock-management -n 100
```

---

## 🔧 Configuration Nginx (si applicable)

Si vous utilisez Nginx comme reverse proxy:

```bash
# Tester la configuration Nginx
sudo nginx -t

# Recharger Nginx si nécessaire
sudo systemctl reload nginx

# Vérifier le statut
sudo systemctl status nginx
```

---

## 📊 Vérifications Post-Déploiement

### 1. Vérifier la Base de Données

```bash
# Se connecter à PostgreSQL
psql -U postgres -d stock_management

# Lister les tables
\dt

# Vérifier le nombre d'enregistrements
SELECT 'Banks' as table_name, COUNT(*) FROM "Bank"
UNION ALL
SELECT 'Cards', COUNT(*) FROM "Card"
UNION ALL
SELECT 'Locations', COUNT(*) FROM "Location"
UNION ALL
SELECT 'Movements', COUNT(*) FROM "Movement"
UNION ALL
SELECT 'Users', COUNT(*) FROM "User";

# Quitter
\q
```

### 2. Tester les Endpoints API

```bash
# Tester l'API des banques
curl http://localhost:3000/api/banks | jq '.success'

# Tester l'API des cartes
curl http://localhost:3000/api/cards | jq '.success'

# Tester l'API des utilisateurs
curl http://localhost:3000/api/users | jq '.success'
```

### 3. Vérifier les Logs d'Audit

```bash
# Se connecter à la base de données
psql -U postgres -d stock_management

# Vérifier les logs récents
SELECT timestamp, action, module, "entityName", details 
FROM "AuditLog" 
ORDER BY timestamp DESC 
LIMIT 10;

# Quitter
\q
```

---

## 🆘 Résolution de Problèmes

### Problème: Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL est actif
sudo systemctl status postgresql

# Redémarrer PostgreSQL si nécessaire
sudo systemctl restart postgresql

# Vérifier les connexions
psql -U postgres -d stock_management -c "SELECT 1"
```

### Problème: Port déjà utilisé

```bash
# Trouver le processus utilisant le port 3000
sudo lsof -i :3000

# Tuer le processus si nécessaire
sudo kill -9 <PID>

# Redémarrer l'application
pm2 restart stock-management
```

### Problème: Erreurs de build

```bash
# Nettoyer le cache et les builds précédents
rm -rf .next
rm -rf node_modules
npm cache clean --force

# Réinstaller les dépendances
npm install

# Rebuild
npm run build
```

### Problème: Migrations Prisma échouées

```bash
# Réinitialiser les migrations (ATTENTION: perte de données possible)
npx prisma migrate reset

# Ou appliquer manuellement les migrations
npx prisma migrate deploy

# Vérifier l'état des migrations
npx prisma migrate status
```

---

## 📝 Rollback (Retour Arrière)

Si le déploiement échoue, vous pouvez revenir à la version précédente:

```bash
# Voir les commits récents
git log --oneline -10

# Revenir au commit précédent (avant 7dfd383)
git checkout d225c12

# Réinstaller les dépendances
npm install

# Générer Prisma
npx prisma generate

# Rebuild
npm run build

# Redémarrer
pm2 restart stock-management
```

---

## ✅ Checklist de Déploiement

- [ ] Connexion au serveur Red Hat réussie
- [ ] Navigation vers le répertoire du projet
- [ ] Backup de la base de données créé
- [ ] Git pull depuis `origin/main` effectué
- [ ] Commit `7dfd383` confirmé
- [ ] `npm install` exécuté sans erreurs
- [ ] `npx prisma generate` exécuté
- [ ] `npx prisma migrate deploy` exécuté
- [ ] Fichier `.env` vérifié et correct
- [ ] `npm run build` exécuté avec succès
- [ ] Service redémarré (PM2 ou systemd)
- [ ] Application accessible via curl/navigateur
- [ ] Logs vérifiés (pas d'erreurs critiques)
- [ ] Base de données vérifiée (tables et données présentes)
- [ ] Tests API effectués (endpoints répondent correctement)
- [ ] Logs d'audit fonctionnels

---

## 📞 Support

En cas de problème lors du déploiement:

1. Vérifier les logs: `pm2 logs stock-management` ou `journalctl -u stock-management`
2. Vérifier la base de données: `psql -U postgres -d stock_management`
3. Vérifier les variables d'environnement: `cat .env`
4. Consulter la documentation: `CHANGELOG-RECENT.md` et `verification-database.md`

---

## 🔗 Liens Utiles

- **Repository GitHub:** https://github.com/boujelbanemohamed/gestion-stock-smt-V2
- **Branche:** main
- **Dernier commit:** 7dfd383
- **Documentation:** Voir `CHANGELOG-RECENT.md` pour les détails des modifications

---

*Guide généré automatiquement - Dernière mise à jour: $(date '+%Y-%m-%d %H:%M:%S')*
