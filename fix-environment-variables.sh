#!/bin/bash

# Fichier: fix-environment-variables.sh
# Description: Script pour corriger automatiquement les variables d'environnement

# --- Configuration ---
APP_DIR="/var/www/stock-management"
LOG_FILE="$APP_DIR/fix_environment.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du script ---
log_message "--- Démarrage de la correction des variables d'environnement ---"

cd "$APP_DIR" || exit 1

# 1. Vérifier et corriger le fichier .env
log_message "1. Vérification et correction du fichier .env..."
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

# 2. Charger les variables d'environnement
log_message "2. Chargement des variables d'environnement..."
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
  log_message "✓ Variables d'environnement chargées"
else
  log_message "✗ Impossible de charger les variables d'environnement"
  exit 1
fi

# 3. Vérifier les variables critiques
log_message "3. Vérification des variables critiques..."

# Vérifier DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  log_message "✗ DATABASE_URL manquante"
  export DATABASE_URL="postgresql://stockapp:SMT2025@localhost:5432/stock_management?schema=public"
  log_message "✓ DATABASE_URL définie"
else
  log_message "✓ DATABASE_URL: $DATABASE_URL"
fi

# Vérifier NODE_ENV
if [ -z "$NODE_ENV" ]; then
  log_message "✗ NODE_ENV manquante"
  export NODE_ENV="production"
  log_message "✓ NODE_ENV définie"
else
  log_message "✓ NODE_ENV: $NODE_ENV"
fi

# Vérifier SESSION_SECRET
if [ -z "$SESSION_SECRET" ]; then
  log_message "✗ SESSION_SECRET manquante"
  export SESSION_SECRET="przFeJuWQFfZ15KGJ1+atTmeNfPH9IrlMiTVSXqPG08="
  log_message "✓ SESSION_SECRET définie"
else
  log_message "✓ SESSION_SECRET définie"
fi

# Vérifier JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  log_message "✗ JWT_SECRET manquante"
  export JWT_SECRET="Pq5NWU4IuduKa4qTBP7kU/noGGXhzp8eoQLpDy04Sd8="
  log_message "✓ JWT_SECRET définie"
else
  log_message "✓ JWT_SECRET définie"
fi

# Vérifier NEXT_PUBLIC_API_URL
if [ -z "$NEXT_PUBLIC_API_URL" ]; then
  log_message "✗ NEXT_PUBLIC_API_URL manquante"
  export NEXT_PUBLIC_API_URL="https://gstock.monetiquetunisie.com"
  log_message "✓ NEXT_PUBLIC_API_URL définie"
else
  log_message "✓ NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
fi

# 4. Vérifier la connexion à la base de données
log_message "4. Vérification de la connexion à la base de données..."
export PGPASSWORD="SMT2025"
if pg_isready -U stockapp -d stock_management; then
  log_message "✓ Base de données accessible"
else
  log_message "✗ Base de données non accessible"
  log_message "Redémarrage de PostgreSQL..."
  systemctl restart postgresql
  sleep 10
  if pg_isready -U stockapp -d stock_management; then
    log_message "✓ Base de données accessible après redémarrage"
  else
    log_message "✗ Base de données toujours non accessible"
  fi
fi
unset PGPASSWORD

# 5. Vérifier Node.js et NPM
log_message "5. Vérification de Node.js et NPM..."
if command -v node >/dev/null 2>&1; then
  log_message "✓ Node.js: $(node --version)"
else
  log_message "✗ Node.js non installé"
fi

if command -v npm >/dev/null 2>&1; then
  log_message "✓ NPM: $(npm --version)"
else
  log_message "✗ NPM non installé"
fi

# 6. Vérifier PM2
log_message "6. Vérification de PM2..."
if command -v pm2 >/dev/null 2>&1; then
  log_message "✓ PM2: $(pm2 --version)"
else
  log_message "✗ PM2 non installé"
fi

# 7. Vérifier les permissions des fichiers
log_message "7. Vérification des permissions des fichiers..."
if [ -f ".env" ]; then
  chmod 600 .env
  log_message "✓ Permissions du fichier .env corrigées"
fi

# 8. Vérifier l'espace disque
log_message "8. Vérification de l'espace disque..."
DISK_USAGE=$(df -h "$APP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
  log_message "⚠ Espace disque faible: ${DISK_USAGE}%"
else
  log_message "✓ Espace disque OK: ${DISK_USAGE}%"
fi

# 9. Vérifier la mémoire
log_message "9. Vérification de la mémoire..."
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ "$MEMORY_USAGE" -gt 90 ]; then
  log_message "⚠ Mémoire faible: ${MEMORY_USAGE}%"
else
  log_message "✓ Mémoire OK: ${MEMORY_USAGE}%"
fi

# 10. Afficher un résumé des variables d'environnement
log_message "10. Résumé des variables d'environnement..."
echo "=== RÉSUMÉ DES VARIABLES D'ENVIRONNEMENT ===" | tee -a "$LOG_FILE"
echo "DATABASE_URL: $DATABASE_URL" | tee -a "$LOG_FILE"
echo "NODE_ENV: $NODE_ENV" | tee -a "$LOG_FILE"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL" | tee -a "$LOG_FILE"
echo "SESSION_SECRET: $SESSION_SECRET" | tee -a "$LOG_FILE"
echo "JWT_SECRET: $JWT_SECRET" | tee -a "$LOG_FILE"
echo "SMTP_HOST: $SMTP_HOST" | tee -a "$LOG_FILE"
echo "SMTP_PORT: $SMTP_PORT" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_ENABLED: $NOTIFICATIONS_ENABLED" | tee -a "$LOG_FILE"

# 11. Tester l'application
log_message "11. Test de l'application..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  log_message "✓ Application accessible"
else
  log_message "✗ Application non accessible"
fi

log_message "--- Correction des variables d'environnement terminée ---"
log_message "Consultez le fichier de log: $LOG_FILE"
