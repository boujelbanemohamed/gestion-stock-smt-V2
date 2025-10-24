#!/bin/bash

# Fichier: check-environment-variables.sh
# Description: Script pour vérifier et afficher toutes les variables d'environnement du serveur RedHat

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

# 1. Informations système
log_message "1. Informations système..."
echo "=== SYSTÈME ===" | tee -a "$LOG_FILE"
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '\"')" | tee -a "$LOG_FILE"
echo "Kernel: $(uname -r)" | tee -a "$LOG_FILE"
echo "Architecture: $(uname -m)" | tee -a "$LOG_FILE"
echo "Uptime: $(uptime)" | tee -a "$LOG_FILE"

# 2. Variables d'environnement système
log_message "2. Variables d'environnement système..."
echo "=== VARIABLES D'ENVIRONNEMENT SYSTÈME ===" | tee -a "$LOG_FILE"
echo "PATH: $PATH" | tee -a "$LOG_FILE"
echo "HOME: $HOME" | tee -a "$LOG_FILE"
echo "USER: $USER" | tee -a "$LOG_FILE"
echo "SHELL: $SHELL" | tee -a "$LOG_FILE"
echo "PWD: $PWD" | tee -a "$LOG_FILE"
echo "LANG: $LANG" | tee -a "$LOG_FILE"
echo "LC_ALL: $LC_ALL" | tee -a "$LOG_FILE"

# 3. Variables Node.js
log_message "3. Variables Node.js..."
echo "=== VARIABLES NODE.JS ===" | tee -a "$LOG_FILE"
echo "NODE_VERSION: $(node --version 2>/dev/null || echo 'Node.js non installé')" | tee -a "$LOG_FILE"
echo "NPM_VERSION: $(npm --version 2>/dev/null || echo 'NPM non installé')" | tee -a "$LOG_FILE"
echo "NODE_ENV: $NODE_ENV" | tee -a "$LOG_FILE"
echo "NODE_PATH: $NODE_PATH" | tee -a "$LOG_FILE"

# 4. Variables PostgreSQL
log_message "4. Variables PostgreSQL..."
echo "=== VARIABLES POSTGRESQL ===" | tee -a "$LOG_FILE"
echo "PGUSER: $PGUSER" | tee -a "$LOG_FILE"
echo "PGPASSWORD: $PGPASSWORD" | tee -a "$LOG_FILE"
echo "PGDATABASE: $PGDATABASE" | tee -a "$LOG_FILE"
echo "PGHOST: $PGHOST" | tee -a "$LOG_FILE"
echo "PGPORT: $PGPORT" | tee -a "$LOG_FILE"

# 5. Variables de l'application
log_message "5. Variables de l'application..."
echo "=== VARIABLES DE L'APPLICATION ===" | tee -a "$LOG_FILE"
if [ -f ".env" ]; then
  echo "Fichier .env trouvé:" | tee -a "$LOG_FILE"
  cat .env | tee -a "$LOG_FILE"
else
  echo "Fichier .env manquant!" | tee -a "$LOG_FILE"
fi

# 6. Variables PM2
log_message "6. Variables PM2..."
echo "=== VARIABLES PM2 ===" | tee -a "$LOG_FILE"
echo "PM2_HOME: $PM2_HOME" | tee -a "$LOG_FILE"
echo "PM2_USAGE: $PM2_USAGE" | tee -a "$LOG_FILE"
echo "PM2_INTERACTOR: $PM2_INTERACTOR" | tee -a "$LOG_FILE"

# 7. Variables de processus
log_message "7. Variables de processus..."
echo "=== VARIABLES DE PROCESSUS ===" | tee -a "$LOG_FILE"
echo "PID: $$" | tee -a "$LOG_FILE"
echo "PPID: $PPID" | tee -a "$LOG_FILE"
echo "UID: $UID" | tee -a "$LOG_FILE"
echo "EUID: $EUID" | tee -a "$LOG_FILE"
echo "GID: $GID" | tee -a "$LOG_FILE"
echo "EGID: $EGID" | tee -a "$LOG_FILE"

# 8. Variables de réseau
log_message "8. Variables de réseau..."
echo "=== VARIABLES DE RÉSEAU ===" | tee -a "$LOG_FILE"
echo "HOSTNAME: $HOSTNAME" | tee -a "$LOG_FILE"
echo "HOST: $HOST" | tee -a "$LOG_FILE"
echo "HTTP_PROXY: $HTTP_PROXY" | tee -a "$LOG_FILE"
echo "HTTPS_PROXY: $HTTPS_PROXY" | tee -a "$LOG_FILE"
echo "NO_PROXY: $NO_PROXY" | tee -a "$LOG_FILE"

# 9. Variables de sécurité
log_message "9. Variables de sécurité..."
echo "=== VARIABLES DE SÉCURITÉ ===" | tee -a "$LOG_FILE"
echo "SESSION_SECRET: $SESSION_SECRET" | tee -a "$LOG_FILE"
echo "JWT_SECRET: $JWT_SECRET" | tee -a "$LOG_FILE"
echo "DATABASE_URL: $DATABASE_URL" | tee -a "$LOG_FILE"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL" | tee -a "$LOG_FILE"

# 10. Variables SMTP
log_message "10. Variables SMTP..."
echo "=== VARIABLES SMTP ===" | tee -a "$LOG_FILE"
echo "SMTP_HOST: $SMTP_HOST" | tee -a "$LOG_FILE"
echo "SMTP_PORT: $SMTP_PORT" | tee -a "$LOG_FILE"
echo "SMTP_SECURE: $SMTP_SECURE" | tee -a "$LOG_FILE"
echo "SMTP_USER: $SMTP_USER" | tee -a "$LOG_FILE"
echo "SMTP_PASSWORD: $SMTP_PASSWORD" | tee -a "$LOG_FILE"
echo "SMTP_FROM_EMAIL: $SMTP_FROM_EMAIL" | tee -a "$LOG_FILE"
echo "SMTP_FROM_NAME: $SMTP_FROM_NAME" | tee -a "$LOG_FILE"

# 11. Variables de notifications
log_message "11. Variables de notifications..."
echo "=== VARIABLES DE NOTIFICATIONS ===" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_ENABLED: $NOTIFICATIONS_ENABLED" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_LOW_STOCK_ALERTS: $NOTIFICATIONS_LOW_STOCK_ALERTS" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_MOVEMENT_NOTIFICATIONS: $NOTIFICATIONS_MOVEMENT_NOTIFICATIONS" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_USER_ACTIVITY_ALERTS: $NOTIFICATIONS_USER_ACTIVITY_ALERTS" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_LOW_STOCK_THRESHOLD: $NOTIFICATIONS_LOW_STOCK_THRESHOLD" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD: $NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_EMAIL_NOTIFICATIONS: $NOTIFICATIONS_EMAIL_NOTIFICATIONS" | tee -a "$LOG_FILE"
echo "NOTIFICATIONS_IN_APP_NOTIFICATIONS: $NOTIFICATIONS_IN_APP_NOTIFICATIONS" | tee -a "$LOG_FILE"

# 12. Toutes les variables d'environnement
log_message "12. Toutes les variables d'environnement..."
echo "=== TOUTES LES VARIABLES D'ENVIRONNEMENT ===" | tee -a "$LOG_FILE"
env | sort | tee -a "$LOG_FILE"

# 13. Vérification des services
log_message "13. Vérification des services..."
echo "=== SERVICES ===" | tee -a "$LOG_FILE"
echo "PostgreSQL: $(systemctl is-active postgresql 2>/dev/null || echo 'Non disponible')" | tee -a "$LOG_FILE"
echo "PM2: $(pm2 --version 2>/dev/null || echo 'Non disponible')" | tee -a "$LOG_FILE"
echo "Node.js: $(node --version 2>/dev/null || echo 'Non disponible')" | tee -a "$LOG_FILE"
echo "NPM: $(npm --version 2>/dev/null || echo 'Non disponible')" | tee -a "$LOG_FILE"

# 14. Vérification des ports
log_message "14. Vérification des ports..."
echo "=== PORTS ===" | tee -a "$LOG_FILE"
echo "Port 3000: $(netstat -tlnp | grep :3000 || echo 'Non utilisé')" | tee -a "$LOG_FILE"
echo "Port 5432: $(netstat -tlnp | grep :5432 || echo 'Non utilisé')" | tee -a "$LOG_FILE"

# 15. Vérification des processus
log_message "15. Vérification des processus..."
echo "=== PROCESSUS ===" | tee -a "$LOG_FILE"
echo "Processus Node.js:" | tee -a "$LOG_FILE"
ps aux | grep node | grep -v grep | tee -a "$LOG_FILE"
echo "Processus PostgreSQL:" | tee -a "$LOG_FILE"
ps aux | grep postgres | grep -v grep | tee -a "$LOG_FILE"

# 16. Vérification des permissions
log_message "16. Vérification des permissions..."
echo "=== PERMISSIONS ===" | tee -a "$LOG_FILE"
echo "Permissions du répertoire de l'application:" | tee -a "$LOG_FILE"
ls -la "$APP_DIR" | head -10 | tee -a "$LOG_FILE"
echo "Permissions du fichier .env:" | tee -a "$LOG_FILE"
ls -la "$APP_DIR/.env" 2>/dev/null | tee -a "$LOG_FILE"

# 17. Vérification de l'espace disque
log_message "17. Vérification de l'espace disque..."
echo "=== ESPACE DISQUE ===" | tee -a "$LOG_FILE"
df -h | tee -a "$LOG_FILE"

# 18. Vérification de la mémoire
log_message "18. Vérification de la mémoire..."
echo "=== MÉMOIRE ===" | tee -a "$LOG_FILE"
free -h | tee -a "$LOG_FILE"

# 19. Vérification des logs système
log_message "19. Vérification des logs système..."
echo "=== LOGS SYSTÈME ===" | tee -a "$LOG_FILE"
echo "Dernières entrées du journal système:" | tee -a "$LOG_FILE"
journalctl --no-pager -n 20 2>/dev/null | tee -a "$LOG_FILE"

# 20. Test de connexion à la base de données
log_message "20. Test de connexion à la base de données..."
echo "=== TEST DE CONNEXION À LA BASE DE DONNÉES ===" | tee -a "$LOG_FILE"
export PGPASSWORD="SMT2025"
if pg_isready -U stockapp -d stock_management; then
  echo "✓ Base de données accessible" | tee -a "$LOG_FILE"
  echo "Tables disponibles:" | tee -a "$LOG_FILE"
  psql -U stockapp -d stock_management -c "\dt" 2>&1 | tee -a "$LOG_FILE"
else
  echo "✗ Base de données non accessible" | tee -a "$LOG_FILE"
fi
unset PGPASSWORD

log_message "--- Vérification terminée ---"
log_message "Consultez le fichier de log: $LOG_FILE"
log_message "Toutes les variables d'environnement ont été affichées ci-dessus."
