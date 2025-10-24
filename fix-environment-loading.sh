#!/bin/bash

# Fichier: fix-environment-loading.sh
# Description: Script pour corriger le chargement des variables d'environnement

# --- Configuration ---
APP_DIR="/var/www/stock-management"
LOG_FILE="$APP_DIR/fix_environment_loading.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du script ---
log_message "--- Démarrage de la correction du chargement des variables d'environnement ---"

cd "$APP_DIR" || exit 1

# 1. Vérifier le fichier .env
log_message "1. Vérification du fichier .env..."
if [ -f ".env" ]; then
  log_message "✓ Fichier .env trouvé"
else
  log_message "✗ Fichier .env manquant"
  exit 1
fi

# 2. Charger les variables d'environnement
log_message "2. Chargement des variables d'environnement..."
set -a
source .env
set +a

# 3. Vérifier les variables critiques
log_message "3. Vérification des variables critiques après chargement..."

# Vérifier NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
  log_message "✓ NODE_ENV: $NODE_ENV"
else
  log_message "✗ NODE_ENV: $NODE_ENV (devrait être 'production')"
fi

# Vérifier DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
  log_message "✓ DATABASE_URL: Configuré"
else
  log_message "✗ DATABASE_URL: Non configuré"
fi

# Vérifier SESSION_SECRET
if [ -n "$SESSION_SECRET" ]; then
  log_message "✓ SESSION_SECRET: Configuré"
else
  log_message "✗ SESSION_SECRET: Non configuré"
fi

# Vérifier JWT_SECRET
if [ -n "$JWT_SECRET" ]; then
  log_message "✓ JWT_SECRET: Configuré"
else
  log_message "✗ JWT_SECRET: Non configuré"
fi

# Vérifier NEXT_PUBLIC_API_URL
if [ -n "$NEXT_PUBLIC_API_URL" ]; then
  log_message "✓ NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
else
  log_message "✗ NEXT_PUBLIC_API_URL: Non configuré"
fi

# 4. Créer un script de chargement des variables d'environnement
log_message "4. Création d'un script de chargement des variables d'environnement..."
cat << 'EOF' > load-env.sh
#!/bin/bash
# Script pour charger les variables d'environnement depuis .env
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
  echo "Variables d'environnement chargées depuis .env"
else
  echo "Fichier .env non trouvé"
fi
EOF

chmod +x load-env.sh
log_message "✓ Script load-env.sh créé"

# 5. Créer un script de vérification des variables d'environnement
log_message "5. Création d'un script de vérification des variables d'environnement..."
cat << 'EOF' > check-env-loaded.sh
#!/bin/bash
# Script pour vérifier les variables d'environnement chargées

echo "=== VARIABLES D'ENVIRONNEMENT CHARGÉES ==="
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: $DATABASE_URL"
echo "SESSION_SECRET: $SESSION_SECRET"
echo "JWT_SECRET: $JWT_SECRET"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"
echo "SMTP_HOST: $SMTP_HOST"
echo "SMTP_PORT: $SMTP_PORT"
echo "SMTP_USER: $SMTP_USER"
echo "SMTP_FROM_EMAIL: $SMTP_FROM_EMAIL"
echo "NOTIFICATIONS_ENABLED: $NOTIFICATIONS_ENABLED"
echo "NOTIFICATIONS_LOW_STOCK_ALERTS: $NOTIFICATIONS_LOW_STOCK_ALERTS"
echo "NOTIFICATIONS_MOVEMENT_NOTIFICATIONS: $NOTIFICATIONS_MOVEMENT_NOTIFICATIONS"
echo "NOTIFICATIONS_USER_ACTIVITY_ALERTS: $NOTIFICATIONS_USER_ACTIVITY_ALERTS"
echo "NOTIFICATIONS_LOW_STOCK_THRESHOLD: $NOTIFICATIONS_LOW_STOCK_THRESHOLD"
echo "NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD: $NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD"
echo "NOTIFICATIONS_EMAIL_NOTIFICATIONS: $NOTIFICATIONS_EMAIL_NOTIFICATIONS"
echo "NOTIFICATIONS_IN_APP_NOTIFICATIONS: $NOTIFICATIONS_IN_APP_NOTIFICATIONS"
EOF

chmod +x check-env-loaded.sh
log_message "✓ Script check-env-loaded.sh créé"

# 6. Tester le chargement des variables
log_message "6. Test du chargement des variables d'environnement..."
./load-env.sh
./check-env-loaded.sh

# 7. Vérifier que l'application fonctionne toujours
log_message "7. Vérification que l'application fonctionne toujours..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  log_message "✓ Application accessible"
else
  log_message "✗ Application non accessible"
fi

# 8. Test de l'API d'authentification
log_message "8. Test de l'API d'authentification..."
if curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' | grep -q "success"; then
  log_message "✓ API d'authentification fonctionne"
else
  log_message "✗ API d'authentification ne fonctionne pas"
fi

log_message "--- Correction terminée ---"
log_message "Utilisez './load-env.sh' pour charger les variables d'environnement"
log_message "Utilisez './check-env-loaded.sh' pour vérifier les variables chargées"
