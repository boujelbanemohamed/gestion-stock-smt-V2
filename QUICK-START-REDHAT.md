# 🚀 Quick Start - Déploiement Red Hat

**Application:** stock-management  
**Commit actuel:** 2314142  
**Dernière mise à jour:** 10 Janvier 2025

---

## ⚡ Déploiement Ultra-Rapide

```bash
# Sur votre serveur Red Hat
cd /var/www/stock-management
git config --global --add safe.directory $(pwd)
git pull origin main
./deploy.sh
```

**C'est tout !** ✅

---

## 🔧 Solutions aux Problèmes Courants

### Problème 1: "fatal: detected dubious ownership"

```bash
git config --global --add safe.directory /var/www/stock-management
```

✅ **Le script deploy.sh gère maintenant ce problème automatiquement !**

### Problème 2: "database schema is not empty"

```bash
# Relancez simplement le script
./deploy.sh
```

✅ **Le script deploy.sh gère maintenant ce problème automatiquement !**

---

## 📦 Guides Disponibles

| Problème | Guide | Solution Rapide |
|----------|-------|-----------------|
| Propriétaire Git | `FIX-GIT-OWNERSHIP.md` | `git config --global --add safe.directory $(pwd)` |
| Schéma DB non vide | `FIX-DATABASE-SCHEMA.md` | Relancer `./deploy.sh` |
| Guide complet | `DEPLOYMENT-GUIDE.md` | Tout le détail |
| Résumé | `DEPLOYMENT-SUMMARY.md` | Checklist |
| Quick start | `DEPLOIEMENT-README.md` | Ce fichier |

---

## ✅ Le Script deploy.sh Gère Automatiquement

Le script a été amélioré et gère maintenant:

1. ✅ **Problème de propriétaire Git** - Ajoute automatiquement le répertoire comme sûr
2. ✅ **Schéma de base de données existant** - Utilise `db push` au lieu de `migrate deploy`
3. ✅ **Backup automatique** - Crée un backup avant toute modification
4. ✅ **Détection PM2/systemd** - Redémarre automatiquement avec le bon gestionnaire
5. ✅ **Vérifications post-déploiement** - Confirme que tout fonctionne

---

## 🎯 Workflow Complet

```bash
# 1. Se connecter
ssh votre-utilisateur@serveur-redhat

# 2. Naviguer
cd /var/www/stock-management

# 3. Résoudre Git (si nécessaire - une seule fois)
git config --global --add safe.directory $(pwd)

# 4. Déployer
git pull origin main
./deploy.sh

# 5. Vérifier
pm2 logs stock-management
curl http://localhost:3000/api/banks | jq '.success'
```

---

## 📊 Ce Qui Sera Mis à Jour

✅ **Code source** - Toutes les nouvelles fonctionnalités  
✅ **Dépendances** - Packages npm  
✅ **Client Prisma** - ORM mis à jour  
✅ **Build** - Version compilée  

## 🛡️ Ce Qui Sera Préservé

✅ **Toutes vos données** (banques, cartes, utilisateurs, etc.)  
✅ **Configuration** (.env)  
✅ **Base de données PostgreSQL**  
✅ **Logs d'audit**  

---

## ⏱️ Temps de Déploiement

- **Backup:** ~10 secondes
- **Pull:** ~5 secondes
- **npm install:** ~30 secondes
- **Build:** ~60-90 secondes
- **Redémarrage:** ~5 secondes

**Total:** ~2-3 minutes ⏱️

---

## 🔗 Informations Essentielles

- **Repository:** https://github.com/boujelbanemohamed/gestion-stock-smt-V2
- **Branche:** main
- **Application:** stock-management
- **Répertoire:** /var/www/stock-management
- **Base de données:** stock_management
- **Port:** 3000

---

## ✨ Nouveautés de Cette Version

- ✅ Filtre par utilisateur sur les logs
- ✅ Détails des cartes dans l'impression des banques
- ✅ Système de logging automatique complet
- ✅ Gestion automatique des erreurs Git et Prisma
- ✅ Script de déploiement robuste

---

## 📞 Support

**En cas de problème:**

1. Vérifier les logs: `pm2 logs stock-management --lines 50`
2. Consulter: `DEPLOYMENT-GUIDE.md`
3. Solutions spécifiques: `FIX-*.md`

---

## ✅ Vérification Finale

```bash
# Application fonctionne
curl -I http://localhost:3000
# ✅ HTTP/1.1 200 OK

# API répond
curl http://localhost:3000/api/banks | jq '.success'
# ✅ true

# Données préservées
psql -U postgres -d stock_management -c "SELECT COUNT(*) FROM \"Bank\""
# ✅ Vos données sont là
```

---

**Prêt pour le déploiement !** 🚀

*Dernière mise à jour: 10 Janvier 2025 - Commit 2314142*
