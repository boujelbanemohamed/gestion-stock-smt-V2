# 🚀 Guide Rapide de Déploiement sur Red Hat

**Application:** stock-management  
**Repository:** https://github.com/boujelbanemohamed/gestion-stock-smt-V2  
**Branche:** main  
**Dernier commit:** 93ed649

---

## ⚡ Déploiement en 3 Étapes

### Sur votre serveur Red Hat, exécutez:

```bash
# 1. Aller dans le répertoire
cd /var/www/stock-management

# 2. Récupérer les modifications
git pull origin main

# 3. Lancer le déploiement automatique
./deploy.sh
```

**C'est tout !** Le script s'occupe de tout. ✅

---

## 🔧 Résolution du Problème "Propriétaire Douteux"

Si vous obtenez l'erreur `fatal: detected dubious ownership in repository` :

```bash
# Solution rapide (UNE SEULE commande)
git config --global --add safe.directory /var/www/stock-management

# Puis réessayez
git pull origin main
```

📖 **Guide complet:** Voir `FIX-GIT-OWNERSHIP.md`

---

## 📋 Ce Que le Script Fait Automatiquement

Le script `deploy.sh` effectue automatiquement:

1. ✅ Vérification de sécurité Git (gère le problème de propriétaire)
2. ✅ Backup de la base de données PostgreSQL
3. ✅ Récupération des modifications depuis GitHub
4. ✅ Installation des dépendances npm
5. ✅ Génération du client Prisma
6. ✅ Application des migrations de base de données
7. ✅ Build de l'application
8. ✅ Redémarrage du service (PM2 ou systemd)
9. ✅ Vérifications post-déploiement

**Durée estimée:** 2-5 minutes ⏱️

---

## 📦 Documentation Disponible

| Fichier | Description | Usage |
|---------|-------------|-------|
| **DEPLOIEMENT-README.md** | Guide rapide (ce fichier) | Démarrage rapide |
| **deploy.sh** | Script automatisé | `./deploy.sh` |
| **DEPLOYMENT-GUIDE.md** | Guide complet détaillé | Résolution de problèmes |
| **DEPLOYMENT-SUMMARY.md** | Résumé avec checklist | Aide-mémoire |
| **FIX-GIT-OWNERSHIP.md** | Fix erreur propriétaire | Si erreur Git |
| **CHANGELOG-RECENT.md** | Liste des modifications | Voir les changements |
| **verification-database.md** | État de la base de données | Vérification DB |

---

## 🔗 Informations Importantes

- **Nom de l'application:** `stock-management`
- **Répertoire:** `/var/www/stock-management`
- **Base de données:** `stock_management` (PostgreSQL)
- **Port:** 3000 (par défaut)
- **Gestionnaire:** PM2 ou systemd

---

## ⚠️ Avant de Déployer

### Prérequis sur le Serveur Red Hat

- ✅ Node.js installé
- ✅ PostgreSQL installé et configuré
- ✅ PM2 ou systemd configuré
- ✅ Nginx configuré (optionnel)
- ✅ Accès SSH au serveur

### Fichier .env Requis

Le serveur doit avoir un fichier `.env` avec:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/stock_management?schema=public"
NODE_ENV=production
```

---

## 🎯 Commandes Essentielles

### Déployer

```bash
cd /var/www/stock-management && ./deploy.sh
```

### Vérifier les Logs

```bash
pm2 logs stock-management --lines 50
# ou
sudo journalctl -u stock-management -n 50
```

### Redémarrer

```bash
pm2 restart stock-management
# ou
sudo systemctl restart stock-management
```

### Vérifier le Statut

```bash
pm2 status
# ou
sudo systemctl status stock-management
```

---

## 🆘 En Cas de Problème

### 1. Erreur Git "Propriétaire Douteux"

```bash
git config --global --add safe.directory /var/www/stock-management
```

📖 **Guide complet:** `FIX-GIT-OWNERSHIP.md`

### 2. Erreur "Database Schema is Not Empty"

```bash
# Le script deploy.sh gère maintenant ce cas automatiquement
# Il suffit de relancer:
./deploy.sh
```

📖 **Guide complet:** `FIX-DATABASE-SCHEMA.md`

### 3. Erreur de Build

```bash
rm -rf .next node_modules
npm install
npm run build
pm2 restart stock-management
```

### 4. Erreur de Base de Données

```bash
# Vérifier PostgreSQL
sudo systemctl status postgresql

# Vérifier la connexion
psql -U postgres -d stock_management -c "SELECT 1"

# Régénérer Prisma (pour mise à jour)
npx prisma generate
npx prisma db push --skip-generate
```

### 5. Port Déjà Utilisé

```bash
# Trouver le processus
sudo lsof -i :3000

# Tuer le processus
sudo kill -9 <PID>

# Redémarrer
pm2 restart stock-management
```

---

## 📊 Vérification Rapide

Après le déploiement, vérifier que tout fonctionne:

```bash
# 1. Application accessible
curl -I http://localhost:3000

# 2. API fonctionne
curl http://localhost:3000/api/banks | jq '.success'

# 3. Base de données
psql -U postgres -d stock_management -c "\dt"

# 4. Pas d'erreurs
pm2 logs stock-management --lines 20 --err
```

---

## ✅ Résumé Ultra-Rapide

```bash
# Sur Red Hat
cd /var/www/stock-management
git config --global --add safe.directory $(pwd)  # Si erreur propriétaire
git pull origin main
./deploy.sh
```

**Fait !** 🎉

---

## 🔗 Liens

- **GitHub:** https://github.com/boujelbanemohamed/gestion-stock-smt-V2
- **Branche:** main
- **Application:** stock-management

---

*Dernière mise à jour: 10 Janvier 2025*
