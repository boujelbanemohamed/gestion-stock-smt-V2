# 📚 Documentation de Déploiement - Red Hat

**Repository:** https://github.com/boujelbanemohamed/gestion-stock-smt-V2  
**Application:** stock-management  
**Dernier commit:** 159cb9c  
**Date:** 10 Janvier 2025

---

## 🎯 SOLUTION À VOTRE PROBLÈME (Page Logs 404)

### Sur votre serveur Red Hat, exécutez:

```bash
cd /var/www/stock-management
rm -rf .next
npm run build
pm2 restart stock-management
```

**Ensuite, testez:**
```bash
curl -I http://localhost:3000/dashboard/logs
```

Devrait retourner `HTTP/1.1 200 OK` ✅

---

## 📖 Index des Guides

### 🚀 Démarrage Rapide
- **QUICK-START-REDHAT.md** - Déploiement en 3 commandes
- **DEPLOIEMENT-README.md** - Guide illustré pas à pas

### 🔧 Solutions aux Problèmes
- **FIX-GIT-OWNERSHIP.md** - Erreur "propriétaire douteux"
- **FIX-DATABASE-SCHEMA.md** - Erreur "database schema is not empty"
- **FIX-404-LOGS.md** - Page logs retourne 404
- **TROUBLESHOOTING-REDHAT.md** - Guide de dépannage complet (10 problèmes)

### 📘 Documentation Complète
- **DEPLOYMENT-GUIDE.md** - Guide de déploiement détaillé
- **DEPLOYMENT-SUMMARY.md** - Résumé avec checklist
- **CHANGELOG-RECENT.md** - Liste des modifications récentes
- **verification-database.md** - Vérification de la persistance

### 🤖 Scripts
- **deploy.sh** - Script de déploiement automatisé

---

## ⚡ Commandes Essentielles

### Déploiement Complet

```bash
cd /var/www/stock-management
git config --global --add safe.directory $(pwd)
git pull origin main
./deploy.sh
```

### Résoudre l'Erreur 404 sur /dashboard/logs

```bash
cd /var/www/stock-management
rm -rf .next
npm run build
pm2 restart stock-management
```

### Vérifier que Tout Fonctionne

```bash
# Application accessible
curl -I http://localhost:3000

# API fonctionne
curl http://localhost:3000/api/banks | jq '.success'
curl http://localhost:3000/api/logs | jq '.success'

# Pages accessibles
curl -I http://localhost:3000/dashboard/banks
curl -I http://localhost:3000/dashboard/logs

# Logs de l'application
pm2 logs stock-management --lines 30
```

---

## 🔍 Diagnostic Rapide

```bash
# Tout vérifier en une commande
cd /var/www/stock-management && \
echo "=== COMMIT ===" && git log --oneline -1 && \
echo -e "\n=== PM2 ===" && pm2 list | grep stock-management && \
echo -e "\n=== FICHIERS ===" && \
test -f app/dashboard/logs/page.tsx && echo "✓ logs/page.tsx" || echo "✗ logs/page.tsx manquant" && \
test -f components/dashboard/logs-panel.tsx && echo "✓ logs-panel.tsx" || echo "✗ logs-panel.tsx manquant" && \
test -f app/api/logs/route.ts && echo "✓ api/logs/route.ts" || echo "✗ api/logs/route.ts manquant" && \
echo -e "\n=== APPLICATION ===" && curl -I http://localhost:3000 2>&1 | head -1 && \
echo -e "\n=== API ===" && curl -s http://localhost:3000/api/logs | jq '.success'
```

---

## 📊 Informations de Configuration

### Serveur Red Hat

| Élément | Valeur |
|---------|--------|
| **Répertoire** | `/var/www/stock-management` |
| **Application** | `stock-management` |
| **Port** | 3000 |
| **Gestionnaire** | PM2 ou systemd |
| **Base de données** | PostgreSQL (stock_management) |

### Repository GitHub

| Élément | Valeur |
|---------|--------|
| **URL** | https://github.com/boujelbanemohamed/gestion-stock-smt-V2 |
| **Branche** | main |
| **Commit** | 159cb9c |

---

## 🎯 Résolution des 3 Problèmes Principaux

### Problème 1: Propriétaire Git

```bash
git config --global --add safe.directory /var/www/stock-management
```

### Problème 2: Schéma DB

```bash
npx prisma db push --skip-generate
```

### Problème 3: Page 404

```bash
rm -rf .next && npm run build && pm2 restart stock-management
```

---

## ✅ Checklist Complète de Déploiement

### Avant le Déploiement

- [ ] Connexion SSH au serveur réussie
- [ ] Navigation vers `/var/www/stock-management`
- [ ] Backup de la base de données créé

### Pendant le Déploiement

- [ ] `git config --global --add safe.directory $(pwd)` (si erreur Git)
- [ ] `git pull origin main` réussi
- [ ] Commit `159cb9c` ou plus récent confirmé
- [ ] `npm install` exécuté sans erreurs
- [ ] `npx prisma generate` exécuté
- [ ] `npm run build` exécuté avec succès
- [ ] `pm2 restart stock-management` ou `systemctl restart`

### Après le Déploiement

- [ ] Application accessible: `curl -I http://localhost:3000`
- [ ] Page logs OK: `curl -I http://localhost:3000/dashboard/logs`
- [ ] API fonctionne: `curl http://localhost:3000/api/logs | jq '.success'`
- [ ] Pas d'erreurs: `pm2 logs stock-management --err`
- [ ] Données présentes: `psql -c "SELECT COUNT(*) FROM \"Bank\""`

---

## 🚀 Le Plus Simple

**Utilisez le script automatisé qui gère TOUT:**

```bash
cd /var/www/stock-management
./deploy.sh
```

---

## 📞 En Cas de Problème

### Ordre de Consultation

1. **Ce fichier** - Vue d'ensemble et solutions rapides
2. **QUICK-START-REDHAT.md** - Commandes de base
3. **FIX-404-LOGS.md** - Si page logs en erreur
4. **TROUBLESHOOTING-REDHAT.md** - Tous les problèmes
5. **DEPLOYMENT-GUIDE.md** - Guide complet

### Support

- Vérifier les logs: `pm2 logs stock-management`
- Consulter les guides: `ls -1 FIX-*.md DEPLOYMENT-*.md`
- Tester l'API: `curl http://localhost:3000/api/logs`

---

## 🔗 Liens Utiles

- **GitHub:** https://github.com/boujelbanemohamed/gestion-stock-smt-V2
- **Documentation locale:** `ls -1 *.md`
- **Guides FIX:** `ls -1 FIX-*.md`

---

**Prêt pour le déploiement !** 🎉

*Dernière mise à jour: 10 Janvier 2025 - Commit 159cb9c*
