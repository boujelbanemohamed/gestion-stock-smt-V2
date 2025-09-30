# Configuration de la Base de Données PostgreSQL

## Prérequis

1. **PostgreSQL installé** sur votre machine
   - macOS: `brew install postgresql@15`
   - Ubuntu: `sudo apt-get install postgresql`
   - Windows: Télécharger depuis [postgresql.org](https://www.postgresql.org/download/)

2. **Démarrer PostgreSQL**
   - macOS: `brew services start postgresql@15`
   - Ubuntu: `sudo systemctl start postgresql`
   - Windows: Le service démarre automatiquement

## Étapes d'installation

### 1. Créer la base de données

Ouvrez un terminal et exécutez:

```bash
# Se connecter à PostgreSQL
psql postgres

# Créer la base de données
CREATE DATABASE stock_management;

# Créer un utilisateur (optionnel)
CREATE USER admin WITH PASSWORD 'password';

# Donner les droits
GRANT ALL PRIVILEGES ON DATABASE stock_management TO admin;

# Quitter psql
\q
```

### 2. Configurer les variables d'environnement

Le fichier `.env` a déjà été créé. Modifiez-le selon vos paramètres:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/stock_management?schema=public"
```

Remplacez:
- `postgres` par votre nom d'utilisateur PostgreSQL
- `password` par votre mot de passe
- `localhost` par l'adresse de votre serveur si différent
- `5432` par le port si différent

### 3. Installer les dépendances

```bash
# Attendre que npm install se termine (si en cours)
# Puis installer les packages additionnels
npm install -D prisma tsx
npm install @prisma/client bcryptjs
npm install -D @types/bcryptjs
```

### 4. Générer le client Prisma

```bash
npm run db:generate
```

### 5. Créer les tables dans la base de données

**Option A: Migration (recommandé pour la production)**
```bash
npm run db:migrate
```

**Option B: Push (rapide pour le développement)**
```bash
npm run db:push
```

### 6. Peupler la base de données avec des données de test

```bash
npm run db:seed
```

Cela créera:
- 3 utilisateurs de test
- 4 banques
- 4 emplacements
- 4 types de cartes
- Des mouvements de stock
- Des notifications
- La configuration de l'application

### Comptes de test créés

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@monetique.tn | password123 | admin |
| manager@monetique.tn | password123 | manager |
| user@monetique.tn | password123 | user |

## Commandes utiles

```bash
# Générer le client Prisma après modification du schéma
npm run db:generate

# Créer une nouvelle migration
npm run db:migrate

# Pousser les changements sans migration
npm run db:push

# Réinitialiser complètement la base de données
npm run db:reset

# Ouvrir Prisma Studio (interface graphique)
npm run db:studio

# Exécuter le seed manuellement
npm run db:seed
```

## Structure de la base de données

### Tables principales

1. **users** - Utilisateurs du système
2. **banks** - Banques partenaires
3. **cards** - Types de cartes bancaires
4. **locations** - Emplacements de stockage
5. **movements** - Mouvements de stock (entrées, sorties, transferts)
6. **stock_levels** - Niveaux de stock par carte et emplacement
7. **role_permissions** - Permissions par rôle
8. **notifications** - Notifications système
9. **audit_logs** - Journal d'audit
10. **app_config** - Configuration de l'application

## Dépannage

### Erreur de connexion à PostgreSQL

```bash
# Vérifier que PostgreSQL est en cours d'exécution
pg_isready

# Sur macOS
brew services list | grep postgresql

# Sur Ubuntu
sudo systemctl status postgresql
```

### Base de données existe déjà

```bash
# Supprimer et recréer
psql postgres
DROP DATABASE stock_management;
CREATE DATABASE stock_management;
\q
```

### Réinitialiser complètement

```bash
npm run db:reset
# Cela supprimera toutes les données et recréera les tables
```

## Prochaines étapes

Après la configuration de la base de données:

1. Redémarrez le serveur Next.js:
   ```bash
   npm run dev
   ```

2. Connectez-vous avec un compte de test

3. Explorez les différentes fonctionnalités

4. Modifiez les données de seed selon vos besoins dans `prisma/seed.ts`
