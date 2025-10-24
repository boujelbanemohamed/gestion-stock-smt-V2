#!/bin/bash

# Fichier: diagnostic-auth-api.sh
# Description: Script de diagnostic pour l'API d'authentification

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/diagnostic_auth_api.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du diagnostic ---
log_message "--- Démarrage du diagnostic de l'API d'authentification ---"

# 1. Vérifier le statut PM2
log_message "1. Vérification du statut PM2..."
pm2 status

# 2. Vérifier les logs PM2
log_message "2. Vérification des logs PM2 (dernières 100 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 100

# 3. Vérifier l'API d'authentification
log_message "3. Test de l'API d'authentification..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -v 2>&1 | tee -a "$LOG_FILE"

# 4. Vérifier la base de données
log_message "4. Vérification de la base de données..."
export PGPASSWORD="SMT2025"
if pg_isready -U stockapp -d stock_management; then
  log_message "✓ Base de données accessible"
else
  log_message "✗ Base de données non accessible"
fi
unset PGPASSWORD

# 5. Vérifier les tables de la base de données
log_message "5. Vérification des tables de la base de données..."
export PGPASSWORD="SMT2025"
psql -U stockapp -d stock_management -c "\dt" 2>&1 | tee -a "$LOG_FILE"
unset PGPASSWORD

# 6. Vérifier les utilisateurs dans la base de données
log_message "6. Vérification des utilisateurs dans la base de données..."
export PGPASSWORD="SMT2025"
psql -U stockapp -d stock_management -c "SELECT id, email, role, isActive FROM users LIMIT 5;" 2>&1 | tee -a "$LOG_FILE"
unset PGPASSWORD

# 7. Vérifier les permissions des rôles
log_message "7. Vérification des permissions des rôles..."
export PGPASSWORD="SMT2025"
psql -U stockapp -d stock_management -c "SELECT role, permissions FROM role_permissions;" 2>&1 | tee -a "$LOG_FILE"
unset PGPASSWORD

# 8. Vérifier le fichier .env
log_message "8. Vérification du fichier .env..."
if [ -f "$APP_DIR/.env" ]; then
  log_message "Fichier .env trouvé:"
  cat "$APP_DIR/.env" | grep -E "(DATABASE_URL|NODE_ENV|SESSION_SECRET|JWT_SECRET)" | tee -a "$LOG_FILE"
else
  log_message "Fichier .env manquant!"
fi

# 9. Vérifier les fichiers de l'API d'authentification
log_message "9. Vérification des fichiers de l'API d'authentification..."
ls -la "$APP_DIR/app/api/auth/" 2>&1 | tee -a "$LOG_FILE"

# 10. Vérifier le contenu du fichier login route
log_message "10. Vérification du contenu du fichier login route..."
if [ -f "$APP_DIR/app/api/auth/login/route.ts" ]; then
  log_message "Fichier login route trouvé:"
  head -20 "$APP_DIR/app/api/auth/login/route.ts" | tee -a "$LOG_FILE"
else
  log_message "Fichier login route manquant!"
fi

# 11. Vérifier les processus Node.js
log_message "11. Vérification des processus Node.js..."
ps aux | grep node | tee -a "$LOG_FILE"

# 12. Vérifier l'utilisation des ports
log_message "12. Vérification de l'utilisation des ports..."
netstat -tlnp | grep :3000 | tee -a "$LOG_FILE"

# 13. Vérifier l'espace disque
log_message "13. Vérification de l'espace disque..."
df -h | tee -a "$LOG_FILE"

# 14. Vérifier la mémoire
log_message "14. Vérification de la mémoire..."
free -h | tee -a "$LOG_FILE"

# 15. Vérifier les permissions des fichiers
log_message "15. Vérification des permissions des fichiers..."
ls -la "$APP_DIR" | head -10 | tee -a "$LOG_FILE"

log_message "--- Diagnostic terminé ---"
log_message "Consultez les logs ci-dessus pour identifier le problème."
