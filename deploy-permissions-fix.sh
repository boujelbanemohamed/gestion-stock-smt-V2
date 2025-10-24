#!/bin/bash

# Fichier: deploy-permissions-fix.sh
# Description: Script de déploiement pour la correction du système de permissions

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/deploy_permissions_fix.log"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="$APP_DIR/backups"
DATE_TAG=$(date +"%Y%m%d_%H%M%S")
DB_NAME="stock_management"
DB_USER="stockapp"
DB_PASSWORD="SMT2025"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

error_exit() {
  log_message "ERREUR: $1"
  log_message "Déploiement échoué."
  exit 1
}

# Fonction de rollback
rollback() {
  log_message "--- Démarrage du Rollback ---"
  if [ -d "$APP_DIR.bak" ]; then
    log_message "Restauration de la version précédente du code..."
    rm -rf "$APP_DIR/*" "$APP_DIR/.*" 2>/dev/null
    cp -R "$APP_DIR.bak/." "$APP_DIR/" || log_message "Avertissement: Échec de la copie des fichiers de backup."
    rm -rf "$APP_DIR.bak"
    
    log_message "Réinstallation des dépendances de la version précédente..."
    cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR pour le rollback."
    npm cache clean --force || log_message "Avertissement: Échec du nettoyage du cache npm."
    npm install --force || log_message "Avertissement: Échec de la réinstallation des dépendances."
    
    log_message "Regénération de Prisma Client pour la version précédente..."
    npx prisma generate || log_message "Avertissement: Échec de la regénération de Prisma Client."
    
    log_message "Reconstruction de l'application pour la version précédente..."
    npm run build || log_message "Avertissement: Échec de la reconstruction de l'application."
    
    log_message "Redémarrage de l'application PM2 à l'état précédent..."
    pm2 delete "$PM2_APP_NAME" 2>/dev/null
    pm2 start npm --name "$PM2_APP_NAME" -- run start || log_message "Avertissement: Échec du redémarrage de PM2."
    log_message "Rollback terminé. L'application devrait être revenue à l'état précédent."
  else
    log_message "Aucune sauvegarde trouvée pour le rollback."
  fi
  exit 1
}

# Piège pour le rollback en cas d'erreur
trap 'rollback' ERR

# --- Début du script de déploiement ---
log_message "--- Démarrage du déploiement de la correction des permissions ---"
mkdir -p "$BACKUP_DIR" || error_exit "Impossible de créer le répertoire de backups."

# 1. Vérification de l'environnement
log_message "1. Vérification de l'environnement..."
if [ ! -d "$APP_DIR" ]; then
  error_exit "Le répertoire de l'application $APP_DIR n'existe pas. Veuillez cloner le dépôt d'abord."
fi
cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR."

# 2. Sauvegarde de la base de données
log_message "2. Sauvegarde de la base de données..."
export PGPASSWORD="$DB_PASSWORD"
if pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_DIR/db_backup_$DATE_TAG.sql"; then
  log_message "✓ Base de données sauvegardée avec succès: $BACKUP_DIR/db_backup_$DATE_TAG.sql"
else
  error_exit "Échec de la sauvegarde de la base de données. Vérifiez les identifiants et l'accès."
fi
unset PGPASSWORD

# 3. Sauvegarde de la version actuelle du code (pour rollback)
log_message "3. Sauvegarde de la version actuelle du code pour un éventuel rollback..."
rm -rf "$APP_DIR.bak"
cp -R "$APP_DIR" "$APP_DIR.bak" || error_exit "Échec de la sauvegarde du répertoire de l'application."
log_message "✓ Version actuelle du code sauvegardée dans $APP_DIR.bak"

# 4. Mise à jour du code depuis Git
log_message "4. Mise à jour du code depuis Git..."
git fetch origin || error_exit "Échec de la récupération des dernières modifications depuis Git."
git reset --hard origin/main || error_exit "Échec du reset hard vers origin/main."
log_message "✓ Code mis à jour avec succès depuis 'origin/main'."

# 5. Vérification et création du fichier .env
log_message "5. Vérification et création du fichier .env..."
if [ ! -f "$ENV_FILE" ]; then
  log_message "Création du fichier .env avec la configuration par défaut..."
  cat << EOF > "$ENV_FILE"
# Base de données PostgreSQL
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"

# Configuration de l'application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://gstock.monetiquetunisie.com"

# Session et sécurité
SESSION_SECRET="przFeJuWQFfZ15KGJ1+atTmeNfPH9IrlMiTVSXqPG08="
JWT_SECRET="Pq5NWU4IuduKa4qTBP7kU/noGGXhzp8eoQLpDy04Sd8="

# Configuration SMTP (à adapter)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM_EMAIL="noreply@gstock.monetiquetunisie.com"
SMTP_FROM_NAME="Monetique Tunisie - Gestion de Stocks"

# Configuration des notifications
NOTIFICATIONS_ENABLED="true"
NOTIFICATIONS_LOW_STOCK_ALERTS="true"
NOTIFICATIONS_MOVEMENT_NOTIFICATIONS="true"
NOTIFICATIONS_USER_ACTIVITY_ALERTS="true"
NOTIFICATIONS_LOW_STOCK_THRESHOLD="10"
NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD="5"
NOTIFICATIONS_EMAIL_NOTIFICATIONS="true"
NOTIFICATIONS_IN_APP_NOTIFICATIONS="true"
EOF
  log_message "✓ Fichier .env créé avec succès."
else
  log_message "✓ Fichier .env déjà existant. Assurez-vous qu'il contient les bonnes variables."
fi

# Charger les variables d'environnement pour le script (sécurisé)
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# 6. Installation des dépendances
log_message "6. Installation des dépendances..."
npm cache clean --force || log_message "Avertissement: Échec du nettoyage du cache npm."
npm install --force || error_exit "Échec de l'installation des dépendances."
log_message "✓ Dépendances installées."

# 7. Regénération de Prisma Client
log_message "7. Regénération de Prisma Client..."
npx prisma generate || error_exit "Échec de la regénération de Prisma Client."
log_message "✓ Prisma Client regénéré."

# 8. Synchronisation de la base de données (non-destructive)
log_message "8. Synchronisation de la base de données (non-destructive)..."
npx prisma db push || error_exit "Échec de la synchronisation de la base de données."
log_message "✓ Base de données synchronisée."

# 9. Construction de l'application Next.js
log_message "9. Construction de l'application Next.js..."
npm run build || error_exit "Échec de la construction de l'application Next.js."
log_message "✓ Application construite avec succès."

# 10. Redémarrage de l'application avec PM2
log_message "10. Redémarrage de l'application avec PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
sleep 2
pm2 start npm --name "$PM2_APP_NAME" -- run start || error_exit "Échec du démarrage de l'application avec PM2."
log_message "✓ Application redémarrée avec PM2."

# 11. Vérifications post-déploiement
log_message "11. Vérifications post-déploiement..."
log_message "ℹ Attente du démarrage de l'application (10 secondes)..."
sleep 10

APP_URL="http://localhost:3000"
if curl --output /dev/null --silent --head --fail "$APP_URL"; then
  log_message "✓ Application accessible sur $APP_URL"
else
  log_message "⚠ L'application n'est pas accessible sur $APP_URL. Vérifiez les logs PM2."
fi

log_message "--- Déploiement terminé avec succès ---"
rm -rf "$APP_DIR.bak"
exit 0
