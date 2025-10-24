#!/bin/bash

# Fichier: fix-500-error.sh
# Description: Script de réparation pour l'erreur 500

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_500_error.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du script de réparation ---
log_message "--- Démarrage de la réparation de l'erreur 500 ---"

# 1. Arrêter PM2
log_message "1. Arrêt de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 3

# 2. Nettoyer les fichiers temporaires
log_message "2. Nettoyage des fichiers temporaires..."
cd "$APP_DIR" || exit 1
rm -rf .next
rm -rf node_modules/.cache
rm -rf node_modules/@prisma/client
rm -rf node_modules/.prisma

# 3. Vérifier et corriger le fichier .env
log_message "3. Vérification du fichier .env..."
if [ ! -f ".env" ]; then
  log_message "Création du fichier .env..."
  cat << EOF > .env
# Base de données PostgreSQL
DATABASE_URL="postgresql://stockapp:SMT2025@localhost:5432/stock_management?schema=public"

# Configuration de l'application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://gstock.monetiquetunisie.com"

# Session et sécurité
SESSION_SECRET="przFeJuWQFfZ15KGJ1+atTmeNfPH9IrlMiTVSXqPG08="
JWT_SECRET="Pq5NWU4IuduKa4qTBP7kU/noGGXhzp8eoQLpDy04Sd8="

# Configuration SMTP
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
  log_message "✓ Fichier .env créé"
else
  log_message "✓ Fichier .env existe"
fi

# 4. Réinstaller les dépendances
log_message "4. Réinstallation des dépendances..."
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# 5. Régénérer Prisma
log_message "5. Régénération de Prisma..."
npx prisma generate

# 6. Synchroniser la base de données
log_message "6. Synchronisation de la base de données..."
npx prisma db push

# 7. Construire l'application
log_message "7. Construction de l'application..."
npm run build

# 8. Redémarrer l'application
log_message "8. Redémarrage de l'application..."
pm2 start npm --name "$PM2_APP_NAME" -- run start

# 9. Attendre le démarrage
log_message "9. Attente du démarrage (20 secondes)..."
sleep 20

# 10. Vérifier le statut
log_message "10. Vérification du statut..."
pm2 status

# 11. Tester l'application
log_message "11. Test de l'application..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  log_message "✓ Application accessible sur http://localhost:3000"
else
  log_message "✗ Application non accessible, vérifiez les logs:"
  pm2 logs "$PM2_APP_NAME" --lines 20
fi

log_message "--- Réparation terminée ---"
