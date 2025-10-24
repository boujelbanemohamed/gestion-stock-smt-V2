#!/bin/bash

# Fichier: diagnostic-redhat.sh
# Description: Script de diagnostic pour résoudre les problèmes sur RedHat

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/diagnostic.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du diagnostic ---
log_message "--- Démarrage du diagnostic RedHat ---"

# 1. Vérifier le statut PM2
log_message "1. Vérification du statut PM2..."
pm2 status

# 2. Vérifier les logs PM2
log_message "2. Vérification des logs PM2 (dernières 50 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 50

# 3. Vérifier les processus Node.js
log_message "3. Vérification des processus Node.js..."
ps aux | grep node

# 4. Vérifier l'utilisation des ports
log_message "4. Vérification de l'utilisation des ports..."
netstat -tlnp | grep :3000

# 5. Vérifier l'espace disque
log_message "5. Vérification de l'espace disque..."
df -h

# 6. Vérifier la mémoire
log_message "6. Vérification de la mémoire..."
free -h

# 7. Vérifier les fichiers de l'application
log_message "7. Vérification des fichiers de l'application..."
ls -la "$APP_DIR"

# 8. Vérifier le fichier .env
log_message "8. Vérification du fichier .env..."
if [ -f "$APP_DIR/.env" ]; then
  echo "Fichier .env trouvé:"
  cat "$APP_DIR/.env"
else
  echo "Fichier .env manquant!"
fi

# 9. Vérifier la base de données
log_message "9. Vérification de la base de données..."
export PGPASSWORD="SMT2025"
if pg_isready -U stockapp -d stock_management; then
  echo "✓ Base de données accessible"
else
  echo "✗ Base de données non accessible"
fi
unset PGPASSWORD

# 10. Vérifier les permissions des fichiers
log_message "10. Vérification des permissions des fichiers..."
ls -la "$APP_DIR" | head -10

log_message "--- Diagnostic terminé ---"
log_message "Consultez les logs ci-dessus pour identifier le problème."