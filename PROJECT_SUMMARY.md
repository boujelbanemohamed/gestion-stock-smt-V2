# Stock Management Platform - Résumé du Projet

## 📋 Vue d'ensemble

**Application** : Plateforme de gestion de stocks pour cartes bancaires  
**Client** : Monetique Tunisie  
**Technologie** : Next.js 14 + PostgreSQL + Prisma ORM  
**Déploiement** : Red Hat Enterprise Linux  

---

## ✅ Configuration actuelle (Développement)

### Environnement local

- **Serveur** : http://localhost:3001 (en cours d'exécution)
- **Base de données** : PostgreSQL 14.19
- **Nom de la DB** : `stock_management`
- **Utilisateur DB** : `mohamed`
- **Statut** : ✅ Fonctionnel avec données de test

### Comptes de test disponibles

| Email | Mot de passe | Rôle | Permissions |
|-------|--------------|------|-------------|
| admin@monetique.tn | password123 | Administrateur | Accès complet |
| manager@monetique.tn | password123 | Gestionnaire | Gestion opérationnelle |
| user@monetique.tn | password123 | Utilisateur | Lecture seule |

### Données de test chargées

- ✅ 4 banques tunisiennes (BCT, Banque de Tunisie, BIAT, Amen Bank)
- ✅ 4 emplacements de stockage
- ✅ 4 types de cartes bancaires (Visa, Mastercard)
- ✅ Niveaux de stock initialisés
- ✅ Mouvements de test (entrées, sorties, transferts)
- ✅ Notifications système
- ✅ Configuration application complète
- ✅ 3 rôles avec permissions (admin, manager, user)

---

## 🏗️ Architecture technique

### Stack technologique

```
Frontend:
├── Next.js 14 (React Framework)
├── TypeScript
├── Tailwind CSS
├── Shadcn/ui (Components)
├── React Hook Form + Zod (Validation)
└── Recharts (Graphiques)

Backend:
├── Next.js API Routes
├── Prisma ORM
└── PostgreSQL 14

Déploiement:
├── PM2 (Process Manager)
├── Nginx (Reverse Proxy)
└── Red Hat Enterprise Linux
```

### Structure de la base de données

10 tables principales :

1. **users** - Gestion des utilisateurs
2. **banks** - Banques partenaires
3. **cards** - Types de cartes bancaires
4. **locations** - Emplacements de stockage
5. **movements** - Historique des mouvements
6. **stock_levels** - Niveaux de stock par emplacement
7. **role_permissions** - Système de permissions
8. **notifications** - Notifications système
9. **audit_logs** - Journal d'audit
10. **app_config** - Configuration centralisée

### Schéma des relations

```
Bank
├── has many Cards
├── has many Locations
└── referenced by Movements

Card
├── belongs to Bank
├── has many StockLevels
└── has many Movements

Location
├── belongs to Bank
├── has many StockLevels
└── referenced by Movements (from/to)

Movement
├── belongs to Card
├── belongs to User
├── from Location (optional)
└── to Location (optional)
```

---

## 📁 Structure du projet

```
stock-management-V2/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentification
│   │   ├── banks/                # Gestion banques
│   │   ├── cards/                # Gestion cartes
│   │   ├── locations/            # Gestion emplacements
│   │   ├── movements/            # Gestion mouvements
│   │   ├── users/                # Gestion utilisateurs
│   │   ├── roles/                # Gestion rôles
│   │   ├── notifications/        # Notifications
│   │   ├── logs/                 # Logs d'audit
│   │   ├── stats/                # Statistiques
│   │   └── config/               # Configuration
│   ├── dashboard/                # Pages dashboard
│   │   ├── banks/
│   │   ├── cards/
│   │   ├── locations/
│   │   ├── movements/
│   │   ├── users/
│   │   ├── logs/
│   │   ├── config/
│   │   └── profile/
│   └── layout.tsx                # Layout principal
├── components/                   # Composants React
│   ├── auth/                     # Composants auth
│   ├── dashboard/                # Composants dashboard
│   └── ui/                       # Composants UI (Shadcn)
├── lib/                          # Utilitaires
│   ├── types.ts                  # Types TypeScript
│   ├── api-types.ts              # Types API
│   ├── utils.ts                  # Fonctions utilitaires
│   ├── db.ts                     # Client Prisma
│   ├── data-store.ts             # Store de données
│   └── event-bus.ts              # Event bus
├── prisma/                       # Configuration Prisma
│   ├── schema.prisma             # Schéma de la DB
│   └── seed.ts                   # Données de test
├── deployment/                   # 🚀 Scripts de déploiement
│   ├── deploy.sh                 # Script principal
│   ├── nginx.conf                # Config Nginx
│   ├── setup-ssl.sh              # Config SSL
│   ├── backup.sh                 # Sauvegarde auto
│   ├── restore.sh                # Restauration
│   ├── update.sh                 # Mise à jour
│   ├── health-check.sh           # Health check
│   ├── DEPLOYMENT_GUIDE.md       # Guide complet
│   ├── README.md                 # Guide rapide
│   └── .env.production.example   # Config production
├── public/                       # Fichiers statiques
│   └── images/
│       └── monetique-logo.png    # Logo Monetique Tunisie
├── .env                          # Variables d'environnement
├── package.json                  # Dépendances
├── tsconfig.json                 # Config TypeScript
├── DATABASE_SETUP.md             # Guide setup DB
├── PRODUCTION_DEPLOYMENT.md      # 📖 Guide déploiement
└── PROJECT_SUMMARY.md            # 📄 Ce fichier
```

---

## 🚀 Commandes utiles

### Développement

```bash
# Démarrer le serveur de dev
npm run dev

# Linter
npm run lint

# Build pour production
npm run build

# Démarrer en production
npm start
```

### Base de données

```bash
# Générer le client Prisma
npm run db:generate

# Pousser le schéma vers la DB
npm run db:push

# Créer une migration
npm run db:migrate

# Peupler avec des données de test
npm run db:seed

# Réinitialiser la DB
npm run db:reset

# Ouvrir Prisma Studio (interface graphique)
npm run db:studio
```

---

## 📦 Package de déploiement Red Hat

### Scripts créés

1. **deploy.sh** (5.7 KB)
   - Installation automatisée complète
   - Configuration de PostgreSQL, Node.js, Nginx, PM2
   - Setup du firewall et SELinux

2. **nginx.conf** (2.8 KB)
   - Configuration reverse proxy optimisée
   - Compression Gzip
   - Headers de sécurité
   - Cache des fichiers statiques

3. **setup-ssl.sh** (1.2 KB)
   - Installation automatique de Let's Encrypt
   - Renouvellement automatique des certificats

4. **backup.sh** (2.1 KB)
   - Sauvegarde automatique de la DB
   - Sauvegarde des fichiers .env
   - Nettoyage des anciennes sauvegardes

5. **restore.sh** (2.7 KB)
   - Restauration depuis sauvegarde
   - Vérifications de sécurité

6. **update.sh** (1.5 KB)
   - Mise à jour automatique de l'application
   - Sauvegarde avant mise à jour

7. **health-check.sh** (3.4 KB)
   - Vérification de tous les services
   - Monitoring de l'espace disque et mémoire

### Documentation

- **DEPLOYMENT_GUIDE.md** (8 KB) - Guide complet de déploiement
- **README.md** (3 KB) - Guide rapide de démarrage
- **PRODUCTION_DEPLOYMENT.md** - Vue d'ensemble du déploiement

---

## 🔐 Sécurité

### Fonctionnalités de sécurité implémentées

- ✅ Authentification par email/mot de passe
- ✅ Hashage des mots de passe avec bcrypt
- ✅ Système de rôles et permissions granulaires
- ✅ Sessions sécurisées avec JWT
- ✅ Journal d'audit complet
- ✅ Configuration SSL/HTTPS pour la production
- ✅ Protection CSRF (Next.js)
- ✅ Headers de sécurité (Nginx)
- ✅ Validation des données (Zod)

### À configurer en production

- [ ] 2FA (Two-Factor Authentication) - code déjà préparé
- [ ] Rate limiting sur les API
- [ ] WAF (Web Application Firewall)
- [ ] Monitoring des intrusions (fail2ban)
- [ ] Backup chiffrés
- [ ] Rotation des secrets

---

## 📊 Fonctionnalités principales

### 1. Gestion des banques
- CRUD complet (Create, Read, Update, Delete)
- Import en masse depuis Excel
- Filtres et recherche
- Statistiques par banque

### 2. Gestion des cartes
- Types hiérarchiques (Type > Sous-type > Sous-sous-type)
- Seuils de stock (min/max)
- Alertes de stock faible
- Historique des mouvements

### 3. Gestion des emplacements
- Organisation par banque
- Niveaux de stock par emplacement
- Vue d'ensemble des stocks

### 4. Gestion des mouvements
- Entrées de stock
- Sorties de stock
- Transferts inter-emplacements
- Historique complet avec traçabilité

### 5. Gestion des utilisateurs
- Système de rôles (admin, manager, user)
- Permissions granulaires par module
- Activation/désactivation des comptes
- Profil utilisateur

### 6. Notifications
- Alertes de stock faible
- Notifications de mouvements
- Alertes d'activité utilisateur
- Centre de notifications intégré

### 7. Journal d'audit
- Traçabilité complète des actions
- Filtres avancés
- Export des logs
- IP et User-Agent tracking

### 8. Statistiques et tableaux de bord
- Vue d'ensemble en temps réel
- Graphiques de stock
- Tendances de mouvements
- Alertes visuelles

### 9. Configuration système
- Paramètres généraux
- Configuration SMTP
- Paramètres d'affichage
- Sécurité et 2FA
- Gestion des notifications

---

## 🎯 Prochaines améliorations possibles

### Court terme
- [ ] Génération de rapports PDF
- [ ] Export Excel des données
- [ ] Notifications par email
- [ ] Mode hors ligne (PWA)
- [ ] Impression d'étiquettes

### Moyen terme
- [ ] Application mobile (React Native)
- [ ] API REST publique
- [ ] Webhooks pour intégrations
- [ ] Système de validation multi-niveaux
- [ ] Scan de codes-barres

### Long terme
- [ ] Intelligence artificielle pour prédiction de stock
- [ ] Intégration avec systèmes bancaires
- [ ] Multi-tenancy (plusieurs organisations)
- [ ] Blockchain pour traçabilité immuable
- [ ] Analytics avancées avec Machine Learning

---

## 📞 Informations de contact et support

### Documentation

- **Guide d'installation** : `DATABASE_SETUP.md`
- **Guide de déploiement** : `PRODUCTION_DEPLOYMENT.md`
- **Guide technique** : `deployment/DEPLOYMENT_GUIDE.md`

### Ressources externes

- Next.js : https://nextjs.org/docs
- Prisma : https://www.prisma.io/docs
- PostgreSQL : https://www.postgresql.org/docs
- PM2 : https://pm2.keymetrics.io/docs
- Nginx : https://nginx.org/en/docs

---

## 📝 Notes importantes

### Développement

- Le serveur tourne actuellement sur **http://localhost:3001**
- La base de données PostgreSQL est configurée et peuplée
- Tous les comptes de test utilisent le mot de passe `password123`

### Production

- Modifier **TOUS les mots de passe** dans `.env`
- Générer de nouveaux secrets avec `openssl rand -base64 32`
- Configurer SSL immédiatement après le déploiement
- Activer les sauvegardes automatiques dès le premier jour
- Tester la restauration avant de déclarer la production stable

---

## ✅ Checklist de déploiement production

### Pré-déploiement
- [ ] Serveur Red Hat configuré et accessible
- [ ] Nom de domaine configuré et pointant vers le serveur
- [ ] Certificats SSL commandés ou compte Let's Encrypt créé
- [ ] Stratégie de sauvegarde définie
- [ ] Plan de rollback documenté

### Déploiement
- [ ] Fichiers transférés vers le serveur
- [ ] Variables dans `deploy.sh` configurées
- [ ] Script `deploy.sh` exécuté avec succès
- [ ] Application accessible sur le domaine
- [ ] SSL/HTTPS configuré et fonctionnel
- [ ] Sauvegardes automatiques configurées

### Post-déploiement
- [ ] Comptes de test supprimés ou mots de passe changés
- [ ] Monitoring configuré (PM2 Plus, logs)
- [ ] Alertes configurées
- [ ] Documentation d'exploitation créée
- [ ] Équipe formée sur les procédures
- [ ] Tests de charge effectués
- [ ] Plan de maintenance établi

---

**Date de création** : 30 septembre 2025  
**Version du projet** : 1.0  
**Statut** : Prêt pour le déploiement en production 🚀

---

**Bon déploiement !** 🎉
