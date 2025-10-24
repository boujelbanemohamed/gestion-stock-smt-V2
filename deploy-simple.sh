#!/bin/bash

# Fichier: deploy-simple.sh
# Description: Script de déploiement simple et robuste

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/deploy_simple.log"
DB_NAME="stock_management"
DB_USER="stockapp"
DB_PASSWORD="SMT2025"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

error_exit() {
  log_message "ERREUR: $1"
  exit 1
}

# --- Début du script de déploiement ---
log_message "--- Démarrage du déploiement simple ---"

# 1. Vérification de l'environnement
log_message "1. Vérification de l'environnement..."
if [ ! -d "$APP_DIR" ]; then
  error_exit "Le répertoire de l'application $APP_DIR n'existe pas."
fi
cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR."

# 2. Sauvegarde de la base de données
log_message "2. Sauvegarde de la base de données..."
export PGPASSWORD="$DB_PASSWORD"
if pg_dump -U "$DB_USER" -d "$DB_NAME" > "backup_$(date +%Y%m%d_%H%M%S).sql"; then
  log_message "✓ Base de données sauvegardée avec succès"
else
  log_message "⚠ Échec de la sauvegarde de la base de données (continuons...)"
fi
unset PGPASSWORD

# 3. Mise à jour du code depuis Git
log_message "3. Mise à jour du code depuis Git..."
git fetch origin || error_exit "Échec de la récupération des dernières modifications depuis Git."
git reset --hard origin/main || error_exit "Échec du reset hard vers origin/main."
log_message "✓ Code mis à jour avec succès depuis 'origin/main'."

# 4. Nettoyage et installation des dépendances
log_message "4. Nettoyage et installation des dépendances..."
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
log_message "✓ Dépendances installées."

# 5. Regénération de Prisma Client
log_message "5. Regénération de Prisma Client..."
npx prisma generate || error_exit "Échec de la regénération de Prisma Client."
log_message "✓ Prisma Client regénéré."

# 6. Synchronisation de la base de données
log_message "6. Synchronisation de la base de données..."
npx prisma db push || error_exit "Échec de la synchronisation de la base de données."
log_message "✓ Base de données synchronisée."

# 7. Construction de l'application Next.js
log_message "7. Construction de l'application Next.js..."
npm run build || error_exit "Échec de la construction de l'application Next.js."
log_message "✓ Application construite avec succès."

# 8. Redémarrage de l'application avec PM2
log_message "8. Redémarrage de l'application avec PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
sleep 2
pm2 start npm --name "$PM2_APP_NAME" -- run start || error_exit "Échec du démarrage de l'application avec PM2."
log_message "✓ Application redémarrée avec PM2."

# 9. Vérifications post-déploiement
log_message "9. Vérifications post-déploiement..."
log_message "ℹ Attente du démarrage de l'application (15 secondes)..."
sleep 15

# Vérifier le statut PM2
pm2 status

log_message "--- Déploiement terminé avec succès ---"
log_message "Vérifiez que l'application fonctionne avec: pm2 logs $PM2_APP_NAME"
exit 0
