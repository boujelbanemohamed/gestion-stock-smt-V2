# 🚀 Guide de démarrage rapide

## 📋 État actuel du projet

✅ **Environnement LOCAL** : Configuré et fonctionnel
- Serveur : http://localhost:3001 (en cours d'exécution)
- Base de données : PostgreSQL avec données de test
- Git : Initialisé et prêt à être poussé vers GitHub

✅ **Environnement PRODUCTION** : Scripts prêts
- Scripts de déploiement Red Hat : ✅ Créés
- Configuration Nginx : ✅ Prête
- SSL/HTTPS : ✅ Script d'installation prêt
- Sauvegardes : ✅ Scripts configurés

---

## 🎯 Prochaines étapes

### 1️⃣ Pousser le code vers GitHub (MAINTENANT)

\`\`\`bash
cd /Users/mohamed/Desktop/stock-management-V2
git push -u origin main
\`\`\`

**Authentification requise** :
- Username: `boujelbanemohamed`
- Password: Votre Personal Access Token GitHub

📖 **Guide détaillé** : Consultez `PUSH_TO_GITHUB.md`

---

### 2️⃣ Tester en local

\`\`\`bash
# Le serveur tourne déjà sur http://localhost:3001

# Se connecter avec :
Email: admin@monetique.tn
Mot de passe: password123
\`\`\`

**Tester** :
- ✅ Gestion des banques
- ✅ Gestion des cartes
- ✅ Gestion des emplacements
- ✅ Gestion des mouvements
- ✅ Notifications
- ✅ Configuration

---

### 3️⃣ Déployer en production (Plus tard)

**Prérequis** :
- Serveur Red Hat avec accès root
- Nom de domaine configuré

**Commandes** :

\`\`\`bash
# Sur votre Mac
scp -r deployment root@your-server-ip:/tmp/

# Sur le serveur Red Hat
ssh root@your-server-ip
cd /tmp/deployment
nano deploy.sh  # Modifier DOMAIN et DB_PASSWORD
./deploy.sh
\`\`\`

📖 **Guide détaillé** : Consultez `PRODUCTION_DEPLOYMENT.md`

---

## 📁 Documentation disponible

| Fichier | Contenu |
|---------|---------|
| **README.md** | Vue d'ensemble du projet |
| **PUSH_TO_GITHUB.md** | ⭐ Comment pousser vers GitHub |
| **ENVIRONMENTS.md** | Gestion des 2 environnements (Local vs Prod) |
| **DATABASE_SETUP.md** | Configuration PostgreSQL |
| **PRODUCTION_DEPLOYMENT.md** | Guide de déploiement complet |
| **PROJECT_SUMMARY.md** | Architecture et résumé technique |
| **deployment/DEPLOYMENT_GUIDE.md** | Guide technique détaillé Red Hat |

---

## 🔧 Commandes utiles

### Développement local

\`\`\`bash
# Démarrer le serveur (déjà en cours)
npm run dev

# Voir les logs de la base de données
npm run db:studio

# Réinitialiser les données de test
npm run db:reset
npm run db:seed
\`\`\`

### Git / GitHub

\`\`\`bash
# Pousser le code
git push

# Après modifications
git add .
git commit -m "feat: description des changements"
git push
\`\`\`

### Production (sur le serveur)

\`\`\`bash
pm2 status                    # Statut
pm2 logs stock-management     # Logs
pm2 restart stock-management  # Redémarrer
\`\`\`

---

## 🎯 Workflow recommandé

### Phase 1 : Développement local (MAINTENANT)

1. ✅ Pousser le code vers GitHub
2. ✅ Tester toutes les fonctionnalités en local
3. ✅ Corriger les bugs éventuels
4. ✅ Ajouter les fonctionnalités manquantes

### Phase 2 : Préparation production

1. Préparer un serveur Red Hat de test
2. Tester le déploiement avec les scripts
3. Valider que tout fonctionne
4. Documenter les procédures spécifiques

### Phase 3 : Mise en production

1. Serveur Red Hat production prêt
2. Domaine configuré
3. Exécuter `deploy.sh`
4. Configurer SSL avec `setup-ssl.sh`
5. Configurer les sauvegardes automatiques
6. Former les utilisateurs

---

## 📊 Deux environnements configurés

### 🖥️ LOCAL (Développement)

**Fichier de config** : `.env.local`

\`\`\`
DATABASE_URL="postgresql://mohamed@localhost:5432/stock_management"
NODE_ENV="development"
NEXT_PUBLIC_API_URL="http://localhost:3000"
\`\`\`

**Caractéristiques** :
- Hot reload
- Données de test
- Logs détaillés
- Pas de SSL

### 🏭 PRODUCTION (Red Hat)

**Fichier de config** : `.env.production`

\`\`\`
DATABASE_URL="postgresql://stockapp:PASSWORD@localhost:5432/stock_management"
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://votre-domaine.com"
\`\`\`

**Caractéristiques** :
- Code optimisé
- PM2 process manager
- Nginx reverse proxy
- SSL/HTTPS
- Sauvegardes automatiques

📖 **Détails complets** : Consultez `ENVIRONMENTS.md`

---

## 🔐 Comptes de test (Local uniquement)

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@monetique.tn | password123 | Administrateur |
| manager@monetique.tn | password123 | Gestionnaire |
| user@monetique.tn | password123 | Utilisateur |

⚠️ **Production** : Créez de nouveaux comptes avec des mots de passe forts !

---

## ❓ FAQ

### Le serveur local ne démarre pas ?

\`\`\`bash
# Vérifier PostgreSQL
pg_isready

# Réinstaller les dépendances
npm install

# Regénérer Prisma
npm run db:generate
\`\`\`

### Comment arrêter le serveur local ?

\`\`\`bash
# Trouver le processus
lsof -i :3001

# Tuer le processus
kill -9 [PID]

# Ou simplement Ctrl+C dans le terminal
\`\`\`

### Comment changer de port ?

\`\`\`bash
# Le port est automatiquement sélectionné
# 3000 en priorité, sinon 3001, 3002, etc.

# Pour forcer un port :
PORT=4000 npm run dev
\`\`\`

### Git demande un mot de passe ?

Vous avez besoin d'un **Personal Access Token** GitHub :
1. GitHub.com → Settings → Developer settings
2. Personal access tokens → Generate new token
3. Cochez "repo"
4. Utilisez le token comme mot de passe

📖 **Guide complet** : `PUSH_TO_GITHUB.md`

---

## 🆘 Support

### Documentation
- Lisez d'abord le README.md
- Consultez la documentation spécifique à votre besoin

### Dépannage
- Vérifiez les logs : `pm2 logs` (production) ou console (local)
- Consultez les guides de déploiement
- Vérifiez PostgreSQL : `pg_isready`

---

## ✅ Checklist avant production

- [ ] Code poussé vers GitHub
- [ ] Testé en local (toutes les fonctionnalités)
- [ ] Documentation à jour
- [ ] Serveur Red Hat prêt
- [ ] Domaine configuré
- [ ] `.env.production` avec vrais secrets
- [ ] Sauvegardes configurées
- [ ] SSL configuré
- [ ] Tests de charge effectués
- [ ] Équipe formée

---

## 🎉 Félicitations !

Votre projet est prêt pour :
- ✅ Développement en local
- ✅ Collaboration via GitHub
- ✅ Déploiement en production sur Red Hat

**Prochaine action** : `git push -u origin main`

📖 Consultez `PUSH_TO_GITHUB.md` pour les détails.

---

**Bon développement !** 🚀
