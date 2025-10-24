#!/bin/bash

# Fichier: diagnostic-login-error.sh
# Description: Script de diagnostic pour l'erreur de connexion persistante

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/diagnostic_login_error.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du diagnostic ---
log_message "--- Démarrage du diagnostic de l'erreur de connexion persistante ---"

cd "$APP_DIR" || exit 1

# 1. Vérifier le statut PM2
log_message "1. Vérification du statut PM2..."
pm2 status

# 2. Vérifier les logs PM2 récents
log_message "2. Vérification des logs PM2 (dernières 100 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 100

# 3. Tester l'API d'authentification en local
log_message "3. Test de l'API d'authentification en local..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' \
  -v 2>&1 | tee -a "$LOG_FILE"

# 4. Tester l'API d'authentification avec l'URL publique
log_message "4. Test de l'API d'authentification avec l'URL publique..."
curl -X POST https://gstock.monetiquetunisie.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' \
  -v 2>&1 | tee -a "$LOG_FILE"

# 5. Vérifier la configuration Nginx
log_message "5. Vérification de la configuration Nginx..."
if [ -f "/etc/nginx/sites-available/gstock.monetiquetunisie.com" ]; then
  log_message "Configuration Nginx trouvée:"
  cat /etc/nginx/sites-available/gstock.monetiquetunisie.com | tee -a "$LOG_FILE"
else
  log_message "Configuration Nginx non trouvée dans /etc/nginx/sites-available/"
fi

# 6. Vérifier le statut Nginx
log_message "6. Vérification du statut Nginx..."
systemctl status nginx 2>&1 | tee -a "$LOG_FILE"

# 7. Vérifier les logs Nginx
log_message "7. Vérification des logs Nginx (dernières 50 lignes)..."
tail -50 /var/log/nginx/error.log 2>&1 | tee -a "$LOG_FILE"

# 8. Vérifier les logs Nginx d'accès
log_message "8. Vérification des logs Nginx d'accès (dernières 20 lignes)..."
tail -20 /var/log/nginx/access.log 2>&1 | tee -a "$LOG_FILE"

# 9. Vérifier la configuration SSL
log_message "9. Vérification de la configuration SSL..."
if [ -f "/etc/nginx/sites-available/gstock.monetiquetunisie.com" ]; then
  grep -i ssl /etc/nginx/sites-available/gstock.monetiquetunisie.com | tee -a "$LOG_FILE"
fi

# 10. Tester la connectivité réseau
log_message "10. Test de la connectivité réseau..."
ping -c 3 gstock.monetiquetunisie.com 2>&1 | tee -a "$LOG_FILE"

# 11. Vérifier les ports ouverts
log_message "11. Vérification des ports ouverts..."
netstat -tlnp | grep -E ":(80|443|3000)" | tee -a "$LOG_FILE"

# 12. Vérifier les processus Node.js
log_message "12. Vérification des processus Node.js..."
ps aux | grep node | tee -a "$LOG_FILE"

# 13. Vérifier les variables d'environnement dans l'application
log_message "13. Vérification des variables d'environnement dans l'application..."
if [ -f ".env" ]; then
  log_message "Fichier .env:"
  cat .env | tee -a "$LOG_FILE"
fi

# 14. Tester l'application complète
log_message "14. Test de l'application complète..."
curl -I http://localhost:3000 2>&1 | tee -a "$LOG_FILE"
curl -I https://gstock.monetiquetunisie.com 2>&1 | tee -a "$LOG_FILE"

# 15. Vérifier les certificats SSL
log_message "15. Vérification des certificats SSL..."
if command -v openssl &> /dev/null; then
  echo | openssl s_client -servername gstock.monetiquetunisie.com -connect gstock.monetiquetunisie.com:443 2>&1 | grep -E "(subject|issuer|notAfter)" | tee -a "$LOG_FILE"
else
  log_message "OpenSSL non disponible pour vérifier les certificats"
fi

log_message "--- Diagnostic terminé ---"
log_message "Consultez les logs ci-dessus pour identifier le problème."
