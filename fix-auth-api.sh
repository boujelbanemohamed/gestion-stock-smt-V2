#!/bin/bash

# Fichier: fix-auth-api.sh
# Description: Script de réparation pour l'API d'authentification

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_auth_api.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du script de réparation ---
log_message "--- Démarrage de la réparation de l'API d'authentification ---"

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

# 4. Vérifier la base de données
log_message "4. Vérification de la base de données..."
export PGPASSWORD="SMT2025"
if pg_isready -U stockapp -d stock_management; then
  log_message "✓ Base de données accessible"
else
  log_message "✗ Base de données non accessible, redémarrage de PostgreSQL..."
  systemctl restart postgresql
  sleep 5
  if pg_isready -U stockapp -d stock_management; then
    log_message "✓ Base de données accessible après redémarrage"
  else
    log_message "✗ Base de données toujours non accessible"
  fi
fi
unset PGPASSWORD

# 5. Vérifier les tables de la base de données
log_message "5. Vérification des tables de la base de données..."
export PGPASSWORD="SMT2025"
if psql -U stockapp -d stock_management -c "\dt" | grep -q "users"; then
  log_message "✓ Table users trouvée"
else
  log_message "✗ Table users non trouvée"
fi
unset PGPASSWORD

# 6. Réinstaller les dépendances
log_message "6. Réinstallation des dépendances..."
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# 7. Régénérer Prisma
log_message "7. Régénération de Prisma..."
npx prisma generate

# 8. Synchroniser la base de données
log_message "8. Synchronisation de la base de données..."
npx prisma db push

# 9. Construire l'application
log_message "9. Construction de l'application..."
npm run build

# 10. Redémarrer l'application
log_message "10. Redémarrage de l'application..."
pm2 start npm --name "$PM2_APP_NAME" -- run start

# 11. Attendre le démarrage
log_message "11. Attente du démarrage (30 secondes)..."
sleep 30

# 12. Vérifier le statut
log_message "12. Vérification du statut..."
pm2 status

# 13. Tester l'API d'authentification
log_message "13. Test de l'API d'authentification..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/login | grep -q "200\|405"; then
  log_message "✓ API d'authentification accessible"
else
  log_message "✗ API d'authentification non accessible"
  log_message "Logs de l'application:"
  pm2 logs "$PM2_APP_NAME" --lines 20
fi

# 14. Tester l'application complète
log_message "14. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  log_message "✓ Application accessible sur http://localhost:3000"
else
  log_message "✗ Application non accessible"
fi

log_message "--- Réparation terminée ---"
