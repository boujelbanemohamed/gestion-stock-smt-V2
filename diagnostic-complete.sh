#!/bin/bash

# Fichier: diagnostic-complete.sh
# Description: Diagnostic complet pour identifier le problème de connexion

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/diagnostic_complete.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du diagnostic ---
log_message "--- Démarrage du diagnostic complet ---"

cd "$APP_DIR" || exit 1

# 1. Vérifier le statut PM2
log_message "1. Vérification du statut PM2..."
pm2 status

# 2. Vérifier les logs PM2
log_message "2. Vérification des logs PM2 (dernières 50 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 50

# 3. Vérifier le fichier .env
log_message "3. Vérification du fichier .env..."
if [ -f ".env" ]; then
  log_message "Fichier .env trouvé:"
  cat .env | tee -a "$LOG_FILE"
else
  log_message "Fichier .env manquant!"
fi

# 4. Vérifier les variables d'environnement
log_message "4. Vérification des variables d'environnement..."
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: $DATABASE_URL"
echo "SESSION_SECRET: $SESSION_SECRET"
echo "JWT_SECRET: $JWT_SECRET"

# 5. Tester la connexion à la base de données
log_message "5. Test de la connexion à la base de données..."
export PGPASSWORD="SMT2025"
if pg_isready -U stockapp -d stock_management; then
  log_message "✓ Base de données accessible"
else
  log_message "✗ Base de données non accessible"
fi
unset PGPASSWORD

# 6. Tester l'API d'authentification directement
log_message "6. Test de l'API d'authentification..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' \
  -v 2>&1 | tee -a "$LOG_FILE"

# 7. Vérifier les processus Node.js
log_message "7. Vérification des processus Node.js..."
ps aux | grep node | tee -a "$LOG_FILE"

# 8. Vérifier l'utilisation des ports
log_message "8. Vérification de l'utilisation des ports..."
netstat -tlnp | grep :3000 | tee -a "$LOG_FILE"

# 9. Vérifier l'espace disque
log_message "9. Vérification de l'espace disque..."
df -h | tee -a "$LOG_FILE"

# 10. Vérifier la mémoire
log_message "10. Vérification de la mémoire..."
free -h | tee -a "$LOG_FILE"

# 11. Vérifier les fichiers de l'API d'authentification
log_message "11. Vérification des fichiers de l'API d'authentification..."
ls -la app/api/auth/ | tee -a "$LOG_FILE"

# 12. Vérifier le contenu du fichier login route
log_message "12. Vérification du contenu du fichier login route..."
if [ -f "app/api/auth/login/route.ts" ]; then
  log_message "Fichier login route trouvé:"
  head -30 app/api/auth/login/route.ts | tee -a "$LOG_FILE"
else
  log_message "Fichier login route manquant!"
fi

# 13. Vérifier les permissions des fichiers
log_message "13. Vérification des permissions des fichiers..."
ls -la app/api/auth/login/ | tee -a "$LOG_FILE"

# 14. Tester l'application complète
log_message "14. Test de l'application complète..."
curl -I http://localhost:3000 2>&1 | tee -a "$LOG_FILE"

# 15. Vérifier les logs d'erreur système
log_message "15. Vérification des logs d'erreur système..."
tail -20 /var/log/messages 2>/dev/null | tee -a "$LOG_FILE"

log_message "--- Diagnostic terminé ---"
log_message "Consultez les logs ci-dessus pour identifier le problème."
