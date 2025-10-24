#!/bin/bash

# Fichier: fix-database-schema.sh
# Description: Script pour corriger la structure de la base de données

# --- Configuration ---
APP_DIR="/var/www/stock-management"
DB_NAME="stock_management"
DB_USER="stockapp"
DB_PASSWORD="SMT2025"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1"
}

# --- Début du script ---
log_message "--- Démarrage de la correction de la structure de la base de données ---"

cd "$APP_DIR" || exit 1

# 1. Vérifier la connexion à la base de données
log_message "1. Vérification de la connexion à la base de données..."
export PGPASSWORD="$DB_PASSWORD"
if pg_isready -U "$DB_USER" -d "$DB_NAME"; then
  log_message "✓ Base de données accessible"
else
  log_message "✗ Base de données non accessible"
  exit 1
fi

# 2. Vérifier la structure de la table users
log_message "2. Vérification de la structure de la table users..."
psql -U "$DB_USER" -d "$DB_NAME" -c "\d users" 2>&1

# 3. Vérifier les colonnes de la table users
log_message "3. Vérification des colonnes de la table users..."
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';" 2>&1

# 4. Vérifier si la colonne isActive existe
log_message "4. Vérification de l'existence de la colonne isActive..."
ISACTIVE_EXISTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'isActive';" 2>/dev/null | tr -d ' ')

if [ "$ISACTIVE_EXISTS" = "0" ]; then
  log_message "Colonne isActive manquante, ajout de la colonne..."
  psql -U "$DB_USER" -d "$DB_NAME" -c "ALTER TABLE users ADD COLUMN \"isActive\" BOOLEAN DEFAULT true;" 2>&1
  log_message "✓ Colonne isActive ajoutée"
else
  log_message "✓ Colonne isActive existe déjà"
fi

# 5. Vérifier si la colonne isactive (minuscule) existe
log_message "5. Vérification de l'existence de la colonne isactive (minuscule)..."
ISACTIVE_LOWER_EXISTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'isactive';" 2>/dev/null | tr -d ' ')

if [ "$ISACTIVE_LOWER_EXISTS" = "1" ]; then
  log_message "Colonne isactive (minuscule) trouvée, copie des données vers isActive..."
  psql -U "$DB_USER" -d "$DB_NAME" -c "UPDATE users SET \"isActive\" = isactive;" 2>&1
  log_message "✓ Données copiées de isactive vers isActive"
fi

# 6. Vérifier les utilisateurs existants
log_message "6. Vérification des utilisateurs existants..."
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, email, role, \"isActive\" FROM users;" 2>&1

# 7. Créer l'utilisateur de test s'il n'existe pas
log_message "7. Création de l'utilisateur de test..."
USER_EXISTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE email = 'mohamed.boujelbane@monetiquetunisie.com';" 2>/dev/null | tr -d ' ')

if [ "$USER_EXISTS" = "0" ]; then
  log_message "Création de l'utilisateur mohamed.boujelbane@monetiquetunisie.com..."
  
  # Hasher le mot de passe
  HASHED_PASSWORD=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('SMT@2025', 10));")
  
  # Insérer l'utilisateur
  psql -U "$DB_USER" -d "$DB_NAME" -c "
    INSERT INTO users (id, email, password, \"firstName\", \"lastName\", role, \"isActive\", \"createdAt\", \"updatedAt\")
    VALUES (
      'user-$(date +%s)',
      'mohamed.boujelbane@monetiquetunisie.com',
      '$HASHED_PASSWORD',
      'Mohamed',
      'Boujelbane',
      'admin',
      true,
      NOW(),
      NOW()
    );
  " 2>&1
  
  log_message "✓ Utilisateur créé"
else
  log_message "✓ Utilisateur existe déjà"
fi

# 8. Vérifier que l'utilisateur a été créé
log_message "8. Vérification de l'utilisateur créé..."
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, email, role, \"isActive\" FROM users WHERE email = 'mohamed.boujelbane@monetiquetunisie.com';" 2>&1

# 9. Synchroniser Prisma avec la base de données
log_message "9. Synchronisation de Prisma avec la base de données..."
npx prisma db push

# 10. Régénérer Prisma Client
log_message "10. Régénération de Prisma Client..."
npx prisma generate

unset PGPASSWORD

log_message "--- Correction terminée ---"
log_message "L'utilisateur mohamed.boujelbane@monetiquetunisie.com devrait maintenant pouvoir se connecter."
