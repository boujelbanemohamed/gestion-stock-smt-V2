# Gestion des Environnements

Ce projet supporte deux environnements distincts : **Local** (développement) et **Production** (Red Hat).

## 🖥️ Environnement LOCAL (Développement)

### Configuration

**Fichier** : `.env.local` (ou `.env`)

\`\`\`env
DATABASE_URL="postgresql://mohamed@localhost:5432/stock_management"
NODE_ENV="development"
NEXT_PUBLIC_API_URL="http://localhost:3000"
SESSION_SECRET="dev-secret-session-local"
JWT_SECRET="dev-secret-jwt-local"
\`\`\`

### Caractéristiques

- ✅ Hot reload activé
- ✅ Logs détaillés
- ✅ Données de test
- ✅ Prisma Studio disponible
- ✅ Source maps activées
- ✅ Pas de cache agressif

### Commandes

\`\`\`bash
# Démarrer le serveur de développement
npm run dev

# Ouvrir Prisma Studio (interface graphique DB)
npm run db:studio

# Réinitialiser la base de données avec des données de test
npm run db:reset
npm run db:seed

# Voir les logs en temps réel
# (Les logs s'affichent directement dans le terminal)
\`\`\`

### Accès

- **URL** : http://localhost:3000 (ou 3001 si 3000 occupé)
- **Base de données** : PostgreSQL local
- **Utilisateurs** : Comptes de test (admin@monetique.tn / password123)

### Workflow de développement

1. **Modifier le code** → Hot reload automatique
2. **Modifier le schéma DB** → `npm run db:push` → Regénération auto
3. **Tester les changements** → Navigateur + DevTools
4. **Commit** → Git

---

## 🏭 Environnement PRODUCTION (Red Hat)

### Configuration

**Fichier** : `.env.production` (sur le serveur)

\`\`\`env
DATABASE_URL="postgresql://stockapp:SECURE_PASSWORD@localhost:5432/stock_management"
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://votre-domaine.com"
SESSION_SECRET="[Généré avec openssl rand -base64 32]"
JWT_SECRET="[Généré avec openssl rand -base64 32]"
\`\`\`

### Caractéristiques

- ✅ Code optimisé et minifié
- ✅ Gestion par PM2 (process manager)
- ✅ Reverse proxy Nginx
- ✅ SSL/HTTPS activé
- ✅ Logs structurés
- ✅ Sauvegardes automatiques
- ✅ Monitoring activé

### Commandes (sur le serveur)

\`\`\`bash
# Voir le statut de l'application
pm2 status

# Redémarrer l'application
pm2 restart stock-management

# Voir les logs en temps réel
pm2 logs stock-management

# Voir les logs Nginx
tail -f /var/log/nginx/stock-management-access.log

# Sauvegarder la base de données
/usr/local/bin/backup-stock-management.sh

# Mettre à jour l'application
/usr/local/bin/update-stock-management.sh

# Vérifier l'état du système
/usr/local/bin/health-check.sh
\`\`\`

### Accès

- **URL** : https://votre-domaine.com
- **Base de données** : PostgreSQL sur le serveur
- **Utilisateurs** : Comptes réels (créés par les admins)

### Workflow de déploiement

1. **Développement local** → Tests
2. **Commit & Push** → GitHub
3. **Sur le serveur** → `git pull` ou script de mise à jour
4. **Build** → `npm run build`
5. **Redémarrage** → `pm2 restart`

---

## 🔄 Passage d'un environnement à l'autre

### De Local → Production

\`\`\`bash
# 1. Commit votre code
git add .
git commit -m "Nouvelle fonctionnalité"
git push origin main

# 2. Sur le serveur
ssh root@your-server
cd /var/www/stock-management
/usr/local/bin/update-stock-management.sh
\`\`\`

### De Production → Local (pour debug)

\`\`\`bash
# 1. Récupérer une sauvegarde de production
scp root@your-server:/var/backups/stock-management/backup_latest_db.sql.gz .

# 2. Restaurer localement
gunzip backup_latest_db.sql.gz
psql stock_management < backup_latest_db.sql

# 3. Adapter .env pour pointer vers la DB locale
\`\`\`

---

## 📊 Comparaison des environnements

| Aspect | Local (Dev) | Production |
|--------|-------------|------------|
| **Port** | 3000/3001 | 80/443 (via Nginx) |
| **Base de données** | PostgreSQL local | PostgreSQL serveur |
| **Process Manager** | Node.js direct | PM2 |
| **SSL/HTTPS** | Non | Oui (Let's Encrypt) |
| **Logs** | Console | Fichiers + PM2 |
| **Sauvegardes** | Manuelles | Automatiques (cron) |
| **Performance** | Hot reload | Optimisé |
| **Monitoring** | DevTools | PM2 + Nginx logs |
| **Données** | Test | Réelles |
| **Sécurité** | Relax | Stricte |

---

## 🔐 Sécurité par environnement

### Local

- Mots de passe simples OK (password123)
- Pas de SSL nécessaire
- Firewall optionnel
- Données de test

### Production

- ✅ Mots de passe forts obligatoires
- ✅ SSL/HTTPS obligatoire
- ✅ Firewall configuré
- ✅ Secrets générés avec OpenSSL
- ✅ Accès SSH par clés uniquement
- ✅ Mises à jour de sécurité automatiques
- ✅ Fail2ban activé
- ✅ Sauvegardes chiffrées

---

## 🧪 Tests par environnement

### Local

\`\`\`bash
# Tests unitaires
npm test

# Tests d'intégration
npm run test:integration

# Linter
npm run lint

# Type checking
npm run type-check
\`\`\`

### Production

\`\`\`bash
# Health check
/usr/local/bin/health-check.sh

# Tests de charge (optionnel)
artillery run load-test.yml

# Tests de sécurité
npm audit
\`\`\`

---

## 📝 Checklist de migration Local → Production

### Avant le déploiement

- [ ] Tests locaux passent
- [ ] Pas d'erreurs de lint
- [ ] Pas de console.log oubliés
- [ ] .env.production configuré
- [ ] Secrets de production générés
- [ ] Sauvegarde de la DB production actuelle
- [ ] Plan de rollback documenté

### Pendant le déploiement

- [ ] Mode maintenance activé (optionnel)
- [ ] Git pull sur le serveur
- [ ] npm install (nouvelles dépendances)
- [ ] Migrations de DB exécutées
- [ ] Build réussi
- [ ] PM2 redémarré
- [ ] Nginx rechargé

### Après le déploiement

- [ ] Application accessible
- [ ] Pas d'erreurs dans les logs
- [ ] Tests de fumée passent
- [ ] Monitoring OK
- [ ] Performance OK
- [ ] Mode maintenance désactivé

---

## 🆘 Dépannage

### Local ne démarre pas

\`\`\`bash
# Vérifier PostgreSQL
pg_isready

# Vérifier la connexion DB
psql stock_management -c "SELECT 1;"

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# Regénérer Prisma
npm run db:generate
\`\`\`

### Production ne répond pas

\`\`\`bash
# Vérifier les services
systemctl status nginx
systemctl status postgresql
pm2 status

# Voir les logs
pm2 logs stock-management --err
tail -f /var/log/nginx/error.log

# Redémarrer si nécessaire
pm2 restart stock-management
systemctl restart nginx
\`\`\`

---

## 📖 Ressources

- **Local** : `DATABASE_SETUP.md`
- **Production** : `PRODUCTION_DEPLOYMENT.md`
- **Architecture** : `PROJECT_SUMMARY.md`
- **Scripts** : `deployment/`

---

**Développement simplifié, production sécurisée** ✨
