#!/bin/bash

# Fichier: check-environment-variables.sh
# Description: Script pour vérifier les variables d'environnement du serveur RedHat

# --- Configuration ---
APP_DIR="/var/www/stock-management"
LOG_FILE="$APP_DIR/check_environment.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du script ---
log_message "--- Démarrage de la vérification des variables d'environnement ---"

cd "$APP_DIR" || exit 1

# 1. Variables d'environnement système
log_message "1. Variables d'environnement système..."
echo "=== VARIABLES SYSTÈME ===" | tee -a "$LOG_FILE"
echo "USER: $USER" | tee -a "$LOG_FILE"
echo "HOME: $HOME" | tee -a "$LOG_FILE"
echo "PATH: $PATH" | tee -a "$LOG_FILE"
echo "SHELL: $SHELL" | tee -a "$LOG_FILE"
echo "PWD: $PWD" | tee -a "$LOG_FILE"
echo "LANG: $LANG" | tee -a "$LOG_FILE"
echo "TZ: $TZ" | tee -a "$LOG_FILE"

# 2. Variables d'environnement Node.js
log_message "2. Variables d'environnement Node.js..."
echo "=== VARIABLES NODE.JS ===" | tee -a "$LOG_FILE"
echo "NODE_ENV: $NODE_ENV" | tee -a "$LOG_FILE"
echo "NODE_VERSION: $(node --version 2>/dev/null || echo 'Node.js non installé')" | tee -a "$LOG_FILE"
echo "NPM_VERSION: $(npm --version 2>/dev/null || echo 'NPM non installé')" | tee -a "$LOG_FILE"
echo "NVM_VERSION: $(nvm --version 2>/dev/null || echo 'NVM non installé')" | tee -a "$LOG_FILE"

# 3. Variables d'environnement PostgreSQL
log_message "3. Variables d'environnement PostgreSQL..."
echo "=== VARIABLES POSTGRESQL ===" | tee -a "$LOG_FILE"
echo "PGUSER: $PGUSER" | tee -a "$LOG_FILE"
echo "PGPASSWORD: $PGPASSWORD" | tee -a "$LOG_FILE"
echo "PGDATABASE: $PGDATABASE" | tee -a "$LOG_FILE"
echo "PGHOST: $PGHOST" | tee -a "$LOG_FILE"
echo "PGPORT: $PGPORT" | tee -a "$LOG_FILE"

# 4. Variables d'environnement de l'application
log_message "4. Variables d'environnement de l'application..."
echo "=== VARIABLES APPLICATION ===" | tee -a "$LOG_FILE"
if [ -f ".env" ]; then
  echo "Fichier .env trouvé:" | tee -a "$LOG_FILE"
  cat .env | tee -a "$LOG_FILE"
else
  echo "Fichier .env manquant!" | tee -a "$LOG_FILE"
fi

# 5. Variables d'environnement PM2
log_message "5. Variables d'environnement PM2..."
echo "=== VARIABLES PM2 ===" | tee -a "$LOG_FILE"
echo "PM2_HOME: $PM2_HOME" | tee -a "$LOG_FILE"
echo "PM2_USAGE: $PM2_USAGE" | tee -a "$LOG_FILE"
pm2 env 2>&1 | tee -a "$LOG_FILE"

# 6. Variables d'environnement système RedHat
log_message "6. Variables d'environnement système RedHat..."
echo "=== VARIABLES REDHAT ===" | tee -a "$LOG_FILE"
echo "HOSTNAME: $HOSTNAME" | tee -a "$LOG_FILE"
echo "HOSTTYPE: $HOSTTYPE" | tee -a "$LOG_FILE"
echo "OSTYPE: $OSTYPE" | tee -a "$LOG_FILE"
echo "MACHTYPE: $MACHTYPE" | tee -a "$LOG_FILE"

# 7. Variables d'environnement réseau
log_message "7. Variables d'environnement réseau..."
echo "=== VARIABLES RÉSEAU ===" | tee -a "$LOG_FILE"
echo "HTTP_PROXY: $HTTP_PROXY" | tee -a "$LOG_FILE"
echo "HTTPS_PROXY: $HTTPS_PROXY" | tee -a "$LOG_FILE"
echo "NO_PROXY: $NO_PROXY" | tee -a "$LOG_FILE"

# 8. Variables d'environnement de sécurité
log_message "8. Variables d'environnement de sécurité..."
echo "=== VARIABLES SÉCURITÉ ===" | tee -a "$LOG_FILE"
echo "SESSION_SECRET: $SESSION_SECRET" | tee -a "$LOG_FILE"
echo "JWT_SECRET: $JWT_SECRET" | tee -a "$LOG_FILE"

# 9. Variables d'environnement de base de données
log_message "9. Variables d'environnement de base de données..."
echo "=== VARIABLES BASE DE DONNÉES ===" | tee -a "$LOG_FILE"
echo "DATABASE_URL: $DATABASE_URL" | tee -a "$LOG_FILE"

# 10. Variables d'environnement SMTP
log_message "10. Variables d'environnement SMTP..."
echo "=== VARIABLES SMTP ===" | tee -a "$LOG_FILE"
echo "SMTP_HOST: $SMTP_HOST" | tee -a "$LOG_FILE"
echo "SMTP_PORT: $SMTP_PORT" | tee -a "$LOG_FILE"
echo "SMTP_SECURE: $SMTP_SECURE" | tee -a "$LOG_FILE"
echo "SMTP_USER: $SMTP_USER" | tee -a "$LOG_FILE"
echo "SMTP_PASSWORD: $SMTP_PASSWORD" | tee -a "$LOG_FILE"
echo "SMTP_FROM_EMAIL: $SMTP_FROM_EMAIL" | tee -a "$LOG_FILE"
echo "SMTP_FROM_NAME: $SMTP_FROM_NAME" | tee -a "$LOG_FILE"

# 11. Variables d'environnement de notifications
log_message "11. Variables d'environnement de notifications..."
echo "=== VARIABLES NOTIFICATIONS ===" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_ENABLED: $NOTIFICATIONS_ENABLED" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_LOW_STOCK_ALERTS: $NOTIFICATIONS_LOW_STOCK_ALERTS" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_MOVEMENT_NOTIFICATIONS: $NOTIFICATIONS_MOVEMENT_NOTIFICATIONS" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_USER_ACTIVITY_ALERTS: $NOTIFICATIONS_USER_ACTIVITY_ALERTS" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_LOW_STOCK_THRESHOLD: $NOTIFICATIONS_LOW_STOCK_THRESHOLD" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD: $NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_EMAIL_NOTIFICATIONS: $NOTIFICATIONS_EMAIL_NOTIFICATIONS" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_IN_APP_NOTIFICATIONS: $NOTIFICATIONS_IN_APP_NOTIFICATIONS" | tee -a "$LOG_FILE"

# 12. Variables d'environnement de l'API
log_message "12. Variables d'environnement de l'API..."
echo "=== VARIABLES API ===" | tee -a "$LOG_FILE"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL" | tee -a "$LOG_FILE"

# 13. Vérification des variables critiques
log_message "13. Vérification des variables critiques..."
echo "=== VÉRIFICATION VARIABLES CRITIQUES ===" | tee -a "$LOG_FILE"

# Vérifier NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
  echo "✓ NODE_ENV: $NODE_ENV" | tee -a "$LOG_FILE"
else
  echo "✗ NODE_ENV: $NODE_ENV (devrait être 'production')" | tee -a "$LOG_FILE"
fi

# Vérifier DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
  echo "✓ DATABASE_URL: Configuré" | tee -a "$LOG_FILE"
else
  echo "✗ DATABASE_URL: Non configuré" | tee -a "$LOG_FILE"
fi

# Vérifier SESSION_SECRET
if [ -n "$SESSION_SECRET" ]; then
  echo "✓ SESSION_SECRET: Configuré" | tee -a "$LOG_FILE"
else
  echo "✗ SESSION_SECRET: Non configuré" | tee -a "$LOG_FILE"
fi

# Vérifier JWT_SECRET
if [ -n "$JWT_SECRET" ]; then
  echo "✓ JWT_SECRET: Configuré" | tee -a "$LOG_FILE"
else
  echo "✗ JWT_SECRET: Non configuré" | tee -a "$LOG_FILE"
fi

# Vérifier NEXT_PUBLIC_API_URL
if [ -n "$NEXT_PUBLIC_API_URL" ]; then
  echo "✓ NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL" | tee -a "$LOG_FILE"
else
  echo "✗ NEXT_PUBLIC_API_URL: Non configuré" | tee -a "$LOG_FILE"
fi

# 14. Test de connexion à la base de données
log_message "14. Test de connexion à la base de données..."
export PGPASSWORD="SMT2025"
if pg_isready -U stockapp -d stock_management; then
  echo "✓ Base de données accessible" | tee -a "$LOG_FILE"
else
  echo "✗ Base de données non accessible" | tee -a "$LOG_FILE"
fi
unset PGPASSWORD

# 15. Test de l'API d'authentification
log_message "15. Test de l'API d'authentification..."
if curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' | grep -q "success"; then
  echo "✓ API d'authentification fonctionne" | tee -a "$LOG_FILE"
else
  echo "✗ API d'authentification ne fonctionne pas" | tee -a "$LOG_FILE"
fi

# 16. Test de l'application complète
log_message "16. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  echo "✓ Application accessible" | tee -a "$LOG_FILE"
else
  echo "✗ Application non accessible" | tee -a "$LOG_FILE"
fi

log_message "--- Vérification terminée ---"
log_message "Consultez les logs ci-dessus pour vérifier les variables d'environnement."
