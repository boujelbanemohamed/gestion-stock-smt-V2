#!/bin/bash

# Fichier: diagnostic-kpis.sh
# Description: Script de diagnostic pour les nouveaux KPIs

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/diagnostic_kpis.log"
APP_URL="http://localhost:3000"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du diagnostic ---
log_message "--- Démarrage du diagnostic des KPIs ---"

cd "$APP_DIR" || exit 1

# 1. Vérifier le statut PM2
log_message "1. Vérification du statut PM2..."
pm2 status

# 2. Vérifier les logs PM2 récents
log_message "2. Vérification des logs PM2 (dernières 50 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 50

# 3. Tester l'API stats directement
log_message "3. Test de l'API stats..."
STATS_RESPONSE=$(curl -s "$APP_URL/api/stats")
log_message "Réponse API Stats: $STATS_RESPONSE"

# 4. Vérifier si l'application est accessible
log_message "4. Test de l'application..."
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200"; then
  log_message "✓ Application accessible sur $APP_URL"
else
  log_message "❌ Application non accessible sur $APP_URL"
fi

# 5. Vérifier les fichiers modifiés
log_message "5. Vérification des fichiers modifiés..."
if [ -f "app/api/stats/route.ts" ]; then
  log_message "✓ Fichier app/api/stats/route.ts existe"
  # Vérifier si les nouveaux KPIs sont dans le fichier
  if grep -q "totalStockVolume" app/api/stats/route.ts; then
    log_message "✓ Nouveaux KPIs trouvés dans l'API"
  else
    log_message "❌ Nouveaux KPIs non trouvés dans l'API"
  fi
else
  log_message "❌ Fichier app/api/stats/route.ts manquant"
fi

if [ -f "components/dashboard/dashboard.tsx" ]; then
  log_message "✓ Fichier components/dashboard/dashboard.tsx existe"
  # Vérifier si les nouveaux KPIs sont dans le composant
  if grep -q "totalStockVolume" components/dashboard/dashboard.tsx; then
    log_message "✓ Nouveaux KPIs trouvés dans le composant Dashboard"
  else
    log_message "❌ Nouveaux KPIs non trouvés dans le composant Dashboard"
  fi
else
  log_message "❌ Fichier components/dashboard/dashboard.tsx manquant"
fi

# 6. Vérifier la construction
log_message "6. Vérification de la construction..."
if [ -d ".next" ]; then
  log_message "✓ Application construite (.next trouvé)"
else
  log_message "❌ Application non construite"
fi

# 7. Tester l'API avec plus de détails
log_message "7. Test détaillé de l'API stats..."
curl -v "$APP_URL/api/stats" 2>&1 | tee -a "$LOG_FILE"

# 8. Vérifier les variables d'environnement
log_message "8. Vérification des variables d'environnement..."
if [ -f ".env" ]; then
  log_message "✓ Fichier .env trouvé"
  cat .env | head -5 | tee -a "$LOG_FILE"
else
  log_message "❌ Fichier .env manquant"
fi

# 9. Redémarrer l'application avec les variables d'environnement
log_message "9. Redémarrage de l'application avec les variables d'environnement..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
sleep 3

# Charger les variables d'environnement
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
  log_message "✓ Variables d'environnement chargées"
fi

# Redémarrer l'application
pm2 start npm --name "$PM2_APP_NAME" -- run start
log_message "✓ Application redémarrée"

# 10. Attendre le démarrage
log_message "10. Attente du démarrage (30 secondes)..."
sleep 30

# 11. Vérifier le statut final
log_message "11. Vérification du statut final..."
pm2 status

# 12. Test final de l'API
log_message "12. Test final de l'API stats..."
FINAL_STATS_RESPONSE=$(curl -s "$APP_URL/api/stats")
log_message "Réponse finale API Stats: $FINAL_STATS_RESPONSE"

# 13. Vérifier si les nouveaux KPIs sont présents
if echo "$FINAL_STATS_RESPONSE" | grep -q "totalStockVolume"; then
  log_message "✓ Nouveaux KPIs présents dans l'API"
else
  log_message "❌ Nouveaux KPIs absents de l'API"
fi

log_message "--- Diagnostic terminé ---"
log_message "Consultez le fichier $LOG_FILE pour les détails."
