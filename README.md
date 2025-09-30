# 🏦 Stock Management Platform - Monetique Tunisie

Plateforme de gestion de stocks pour cartes bancaires développée pour Monetique Tunisie.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-blue)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)

## 📋 Table des matières

- [Fonctionnalités](#fonctionnalités)
- [Technologies utilisées](#technologies-utilisées)
- [Installation locale](#installation-locale)
- [Déploiement en production](#déploiement-en-production)
- [Configuration des environnements](#configuration-des-environnements)
- [Utilisation](#utilisation)
- [Documentation](#documentation)

## ✨ Fonctionnalités

### Gestion complète

- 🏦 **Gestion des banques** - CRUD complet avec import Excel
- 💳 **Gestion des cartes** - Types hiérarchiques avec seuils de stock
- 📍 **Gestion des emplacements** - Organisation par banque
- 📦 **Gestion des mouvements** - Entrées, sorties, transferts
- 👥 **Gestion des utilisateurs** - Système de rôles et permissions
- 🔔 **Notifications** - Alertes en temps réel
- 📊 **Statistiques** - Tableaux de bord et graphiques
- 📝 **Journal d'audit** - Traçabilité complète
- ⚙️ **Configuration** - Paramètres système centralisés

### Sécurité

- 🔐 Authentification sécurisée
- 👤 Système de rôles (Admin, Manager, User)
- 🛡️ Permissions granulaires par module
- 📋 Journal d'audit complet
- 🔒 Support 2FA (configurable)

## 🛠️ Technologies utilisées

### Frontend

- **Next.js 14** - Framework React avec App Router
- **TypeScript** - Typage statique
- **Tailwind CSS** - Framework CSS utilitaire
- **Shadcn/ui** - Composants UI
- **Recharts** - Graphiques et visualisations

### Backend

- **Next.js API Routes** - API REST
- **Prisma ORM** - ORM pour PostgreSQL
- **PostgreSQL 14+** - Base de données relationnelle
- **Zod** - Validation des schémas

### Déploiement

- **PM2** - Process manager
- **Nginx** - Reverse proxy
- **Let's Encrypt** - Certificats SSL gratuits

## 🚀 Installation locale

### Prérequis

- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

### Étapes d'installation

1. **Cloner le projet**

\`\`\`bash
git clone https://github.com/boujelbanemohamed/gestion-stock-smt-V2.git
cd gestion-stock-smt-V2
\`\`\`

2. **Installer les dépendances**

\`\`\`bash
npm install
\`\`\`

3. **Configurer PostgreSQL**

\`\`\`bash
# Se connecter à PostgreSQL
psql postgres

# Créer la base de données
CREATE DATABASE stock_management;

# Quitter
\\q
\`\`\`

4. **Configurer les variables d'environnement**

\`\`\`bash
# Copier le fichier .env.local
cp .env.local .env

# Modifier si nécessaire (surtout DATABASE_URL)
nano .env
\`\`\`

5. **Initialiser la base de données**

\`\`\`bash
# Générer le client Prisma
npm run db:generate

# Créer les tables
npm run db:push

# Peupler avec des données de test
npm run db:seed
\`\`\`

6. **Démarrer le serveur de développement**

\`\`\`bash
npm run dev
\`\`\`

L'application sera accessible sur **http://localhost:3000**

### 🔑 Comptes de test

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@monetique.tn | password123 | Administrateur |
| manager@monetique.tn | password123 | Gestionnaire |
| user@monetique.tn | password123 | Utilisateur |

## 🏭 Déploiement en production

### Sur Red Hat Enterprise Linux / CentOS

Le projet inclut des scripts de déploiement automatisés pour Red Hat.

1. **Transférer les fichiers vers le serveur**

\`\`\`bash
scp -r deployment root@your-server-ip:/tmp/
scp -r * root@your-server-ip:/tmp/stock-management-app/
\`\`\`

2. **Configurer le déploiement**

\`\`\`bash
ssh root@your-server-ip
cd /tmp/deployment
nano deploy.sh

# Modifier ces variables :
# DOMAIN="votre-domaine.com"
# DB_PASSWORD="VotreMotDePasseSécurisé"
\`\`\`

3. **Exécuter le déploiement**

\`\`\`bash
chmod +x deploy.sh
./deploy.sh
\`\`\`

4. **Configurer SSL**

\`\`\`bash
nano setup-ssl.sh  # Modifier domaine et email
./setup-ssl.sh
\`\`\`

📖 **Documentation complète** : Consultez `PRODUCTION_DEPLOYMENT.md` et `deployment/DEPLOYMENT_GUIDE.md`

## ⚙️ Configuration des environnements

### Environnement LOCAL (Développement)

Fichier : `.env.local` (ou `.env`)

\`\`\`env
DATABASE_URL="postgresql://user@localhost:5432/stock_management"
NODE_ENV="development"
NEXT_PUBLIC_API_URL="http://localhost:3000"
\`\`\`

**Commandes** :
\`\`\`bash
npm run dev          # Démarrer en mode dev
npm run db:studio    # Interface graphique DB
npm run db:seed      # Réinitialiser les données de test
\`\`\`

### Environnement PRODUCTION

Fichier : `.env.production`

\`\`\`env
DATABASE_URL="postgresql://stockapp:password@localhost:5432/stock_management"
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://votre-domaine.com"
\`\`\`

**Commandes** :
\`\`\`bash
npm run build        # Build pour production
npm start            # Démarrer en mode production
pm2 start npm --name stock-management -- start  # Avec PM2
\`\`\`

## 📚 Documentation

- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - Configuration de la base de données
- **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)** - Guide de déploiement production
- **[deployment/DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md)** - Guide technique détaillé
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Architecture et résumé du projet

## 🗂️ Structure du projet

\`\`\`
stock-management-V2/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   └── dashboard/         # Pages dashboard
├── components/            # Composants React
│   ├── auth/             # Authentification
│   ├── dashboard/        # Composants métier
│   └── ui/               # Composants UI (Shadcn)
├── lib/                   # Utilitaires
│   ├── types.ts          # Types TypeScript
│   ├── db.ts             # Client Prisma
│   └── utils.ts          # Fonctions utilitaires
├── prisma/               # Configuration Prisma
│   ├── schema.prisma     # Schéma de la DB
│   └── seed.ts           # Données de test
├── deployment/           # Scripts de déploiement
│   ├── deploy.sh         # Déploiement automatique
│   ├── nginx.conf        # Config Nginx
│   ├── backup.sh         # Sauvegarde
│   └── *.sh              # Autres scripts
└── public/               # Fichiers statiques
\`\`\`

## 🔧 Commandes utiles

### Développement

\`\`\`bash
npm run dev              # Serveur de développement
npm run build            # Build pour production
npm run start            # Démarrer en production
npm run lint             # Linter
\`\`\`

### Base de données

\`\`\`bash
npm run db:generate      # Générer le client Prisma
npm run db:push          # Pousser le schéma vers la DB
npm run db:migrate       # Créer une migration
npm run db:seed          # Peupler avec des données de test
npm run db:reset         # Réinitialiser la DB
npm run db:studio        # Interface graphique Prisma
\`\`\`

### Production (sur le serveur)

\`\`\`bash
pm2 status                           # Statut de l'app
pm2 logs stock-management            # Logs en temps réel
pm2 restart stock-management         # Redémarrer
/usr/local/bin/backup-stock-management.sh   # Sauvegarde
/usr/local/bin/update-stock-management.sh   # Mise à jour
\`\`\`

## 🤝 Contribution

Ce projet est développé pour Monetique Tunisie. Pour toute contribution :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est propriété de Monetique Tunisie.

## 📞 Contact

Mohamed Boujelbanem - [@boujelbanemohamed](https://github.com/boujelbanemohamed)

Lien du projet : [https://github.com/boujelbanemohamed/gestion-stock-smt-V2](https://github.com/boujelbanemohamed/gestion-stock-smt-V2)

---

**Développé avec ❤️ pour Monetique Tunisie**
