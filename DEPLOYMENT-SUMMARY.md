# Résumé du Déploiement - Red Hat

**Date:** $(date '+%Y-%m-%d %H:%M:%S')

---

## 🎯 Informations Essentielles

| Information | Valeur |
|------------|--------|
| **Repository** | https://github.com/boujelbanemohamed/gestion-stock-smt-V2 |
| **Branche** | `main` |
| **Dernier commit** | `8d49025` |
| **Commit message** | "feat: Ajout du script de déploiement automatisé pour Red Hat" |

---

## 🚀 Commandes Rapides de Déploiement

### Option 1: Script Automatisé (Recommandé)

```bash
# Sur le serveur Red Hat
cd /var/www/gestion-stock-smt-V2
git pull origin main
./deploy.sh
```

### Option 2: Commandes Manuelles

```bash
# Sur le serveur Red Hat
cd /var/www/gestion-stock-smt-V2

# 1. Backup
pg_dump -U postgres stock_management > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Pull
git pull origin main

# 3. Dépendances
npm install

# 4. Prisma
npx prisma generate
npx prisma migrate deploy

# 5. Build
npm run build

# 6. Redémarrage
pm2 restart gestion-stock-smt
# ou
sudo systemctl restart gestion-stock-smt
```

---

## 📋 Checklist Rapide

- [ ] Connexion SSH au serveur Red Hat
- [ ] `cd /var/www/gestion-stock-smt-V2` (ou votre chemin)
- [ ] `git pull origin main`
- [ ] Vérifier commit: `8d49025`
- [ ] `./deploy.sh` (ou commandes manuelles)
- [ ] Tester l'application

---

## 📦 Fichiers de Documentation

| Fichier | Description |
|---------|-------------|
| `DEPLOYMENT-GUIDE.md` | Guide complet de déploiement |
| `CHANGELOG-RECENT.md` | Changelog des modifications récentes |
| `verification-database.md` | Rapport de vérification de la base de données |
| `deploy.sh` | Script de déploiement automatisé |
| `DEPLOYMENT-SUMMARY.md` | Ce fichier (résumé rapide) |

---

## 🔗 URLs Importantes

- **GitHub:** https://github.com/boujelbanemohamed/gestion-stock-smt-V2
- **Application (local):** http://localhost:3000
- **Prisma Studio:** http://localhost:5555

---

## 📞 Commandes de Vérification

```bash
# Vérifier le statut
pm2 status
# ou
sudo systemctl status gestion-stock-smt

# Voir les logs
pm2 logs gestion-stock-smt --lines 50
# ou
sudo journalctl -u gestion-stock-smt -n 50

# Tester l'API
curl http://localhost:3000/api/banks | jq '.success'

# Vérifier la base de données
psql -U postgres -d stock_management -c "\dt"
```

---

## ⚠️ En Cas de Problème

1. **Vérifier les logs:** `pm2 logs gestion-stock-smt`
2. **Consulter le guide:** `cat DEPLOYMENT-GUIDE.md`
3. **Rollback si nécessaire:** `git checkout 779a575` (commit précédent)

---

## ✅ Vérification Post-Déploiement

```bash
# 1. Application accessible
curl -I http://localhost:3000

# 2. Base de données
psql -U postgres -d stock_management -c "SELECT COUNT(*) FROM \"Bank\""

# 3. Logs d'audit
psql -U postgres -d stock_management -c "SELECT COUNT(*) FROM \"AuditLog\""

# 4. Pas d'erreurs dans les logs
pm2 logs gestion-stock-smt --lines 20 --err
```

---

*Généré automatiquement - Dernière mise à jour: $(date '+%Y-%m-%d %H:%M:%S')*
