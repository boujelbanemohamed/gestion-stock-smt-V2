#!/bin/bash

# Fichier: test-database-and-user.sh
# Description: Script pour tester la base de données et créer un utilisateur de test

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
log_message "--- Démarrage du test de la base de données et création d'utilisateur ---"

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

# 2. Vérifier les tables
log_message "2. Vérification des tables..."
psql -U "$DB_USER" -d "$DB_NAME" -c "\dt" 2>&1

# 3. Vérifier les utilisateurs existants
log_message "3. Vérification des utilisateurs existants..."
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, email, role, \"isActive\" FROM users;" 2>&1

# 4. Vérifier les rôles et permissions
log_message "4. Vérification des rôles et permissions..."
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT role, permissions FROM role_permissions;" 2>&1

# 5. Créer un utilisateur de test si nécessaire
log_message "5. Création d'un utilisateur de test..."
export PGPASSWORD="$DB_PASSWORD"

# Vérifier si l'utilisateur test existe déjà
USER_EXISTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE email = 'mohamed.boujelbane@monetiquetunisie.com';" 2>/dev/null | tr -d ' ')

if [ "$USER_EXISTS" = "0" ]; then
  log_message "Création de l'utilisateur mohamed.boujelbane@monetiquetunisie.com..."
  
  # Hasher le mot de passe
  HASHED_PASSWORD=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('SMT@2025', 10));")
  
  # Insérer l'utilisateur
  psql -U "$DB_USER" -d "$DB_NAME" -c "
    INSERT INTO users (id, email, password, firstName, lastName, role, isActive, createdAt, updatedAt)
    VALUES (
      'test-user-$(date +%s)',
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

# 6. Vérifier que l'utilisateur a été créé
log_message "6. Vérification de l'utilisateur créé..."
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, email, role, \"isActive\" FROM users WHERE email = 'mohamed.boujelbane@monetiquetunisie.com';" 2>&1

# 7. Créer un rôle avec permissions si nécessaire
log_message "7. Vérification des rôles..."
ROLE_EXISTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM role_permissions WHERE role = 'admin';" 2>/dev/null | tr -d ' ')

if [ "$ROLE_EXISTS" = "0" ]; then
  log_message "Création du rôle admin avec toutes les permissions..."
  psql -U "$DB_USER" -d "$DB_NAME" -c "
    INSERT INTO role_permissions (id, role, permissions, description, isCustom, createdAt, updatedAt)
    VALUES (
      'admin-role-$(date +%s)',
      'admin',
      ARRAY[
        'dashboard:view',
        'banks:view', 'banks:create', 'banks:update', 'banks:delete',
        'cards:view', 'cards:create', 'cards:update', 'cards:delete',
        'locations:view', 'locations:create', 'locations:update', 'locations:delete',
        'movements:view', 'movements:create', 'movements:update', 'movements:delete',
        'users:view', 'users:create', 'users:update', 'users:delete',
        'logs:view',
        'config:view', 'config:update'
      ],
      'Administrateur avec toutes les permissions',
      false,
      NOW(),
      NOW()
    );
  " 2>&1
  
  log_message "✓ Rôle admin créé"
else
  log_message "✓ Rôle admin existe déjà"
fi

unset PGPASSWORD

log_message "--- Test terminé ---"
log_message "L'utilisateur mohamed.boujelbane@monetiquetunisie.com devrait maintenant pouvoir se connecter."
