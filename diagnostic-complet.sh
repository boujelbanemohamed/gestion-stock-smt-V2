#!/bin/bash

# Fichier: diagnostic-complet.sh
# Description: Script de diagnostic complet pour identifier tous les problèmes

# --- Configuration ---
APP_DIR="/var/www/stock-management"
LOG_FILE="$APP_DIR/diagnostic_complet.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du script ---
log_message "--- Démarrage du diagnostic complet ---"

cd "$APP_DIR" || exit 1

# 1. Informations système
log_message "1. Informations système..."
echo "OS: $(uname -a)" | tee -a "$LOG_FILE"
echo "Node.js: $(node --version)" | tee -a "$LOG_FILE"
echo "NPM: $(npm --version)" | tee -a "$LOG_FILE"
echo "PM2: $(pm2 --version)" | tee -a "$LOG_FILE"

# 2. Statut des services
log_message "2. Statut des services..."
echo "PostgreSQL: $(systemctl is-active postgresql)" | tee -a "$LOG_FILE"
echo "Nginx: $(systemctl is-active nginx)" | tee -a "$LOG_FILE"
pm2 status | tee -a "$LOG_FILE"

# 3. Vérification des fichiers de configuration
log_message "3. Vérification des fichiers de configuration..."
echo "Fichier .env existe: $([ -f ".env" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"
echo "Fichier package.json existe: $([ -f "package.json" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"
echo "Fichier next.config.mjs existe: $([ -f "next.config.mjs" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"
echo "Fichier postcss.config.mjs existe: $([ -f "postcss.config.mjs" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"
echo "Fichier tailwind.config.js existe: $([ -f "tailwind.config.js" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"

# 4. Contenu du package.json
log_message "4. Contenu du package.json..."
cat package.json | tee -a "$LOG_FILE"

# 5. Variables d'environnement
log_message "5. Variables d'environnement..."
if [ -f ".env" ]; then
  echo "Contenu du .env:" | tee -a "$LOG_FILE"
  cat .env | tee -a "$LOG_FILE"
else
  echo "Fichier .env manquant" | tee -a "$LOG_FILE"
fi

# 6. Dépendances installées
log_message "6. Dépendances installées..."
if [ -d "node_modules" ]; then
  echo "node_modules existe" | tee -a "$LOG_FILE"
  echo "Packages liés à Tailwind:" | tee -a "$LOG_FILE"
  ls node_modules | grep -i tailwind | tee -a "$LOG_FILE"
  echo "Packages liés à PostCSS:" | tee -a "$LOG_FILE"
  ls node_modules | grep -i postcss | tee -a "$LOG_FILE"
else
  echo "node_modules n'existe pas" | tee -a "$LOG_FILE"
fi

# 7. Configuration Next.js
log_message "7. Configuration Next.js..."
if [ -f "next.config.mjs" ]; then
  echo "Contenu de next.config.mjs:" | tee -a "$LOG_FILE"
  cat next.config.mjs | tee -a "$LOG_file"
else
  echo "next.config.mjs manquant" | tee -a "$LOG_FILE"
fi

# 8. Configuration PostCSS
log_message "8. Configuration PostCSS..."
if [ -f "postcss.config.mjs" ]; then
  echo "Contenu de postcss.config.mjs:" | tee -a "$LOG_FILE"
  cat postcss.config.mjs | tee -a "$LOG_FILE"
elif [ -f "postcss.config.js" ]; then
  echo "Contenu de postcss.config.js:" | tee -a "$LOG_FILE"
  cat postcss.config.js | tee -a "$LOG_FILE"
else
  echo "Aucun fichier de configuration PostCSS trouvé" | tee -a "$LOG_FILE"
fi

# 9. Configuration Tailwind
log_message "9. Configuration Tailwind..."
if [ -f "tailwind.config.js" ]; then
  echo "Contenu de tailwind.config.js:" | tee -a "$LOG_FILE"
  cat tailwind.config.js | tee -a "$LOG_FILE"
elif [ -f "tailwind.config.ts" ]; then
  echo "Contenu de tailwind.config.ts:" | tee -a "$LOG_FILE"
  cat tailwind.config.ts | tee -a "$LOG_FILE"
else
  echo "Aucun fichier de configuration Tailwind trouvé" | tee -a "$LOG_FILE"
fi

# 10. Fichiers CSS
log_message "10. Fichiers CSS..."
echo "Fichiers CSS trouvés:" | tee -a "$LOG_FILE"
find . -name "*.css" -type f | tee -a "$LOG_FILE"

# 11. Test de connexion à la base de données
log_message "11. Test de connexion à la base de données..."
export PGPASSWORD="SMT2025"
if psql -h localhost -U stockapp -d stock_management -c "SELECT 1;" >/dev/null 2>&1; then
  echo "✓ Connexion à la base de données réussie" | tee -a "$LOG_FILE"
else
  echo "❌ Échec de la connexion à la base de données" | tee -a "$LOG_FILE"
fi
unset PGPASSWORD

# 12. Test de Prisma
log_message "12. Test de Prisma..."
if npx prisma --version >/dev/null 2>&1; then
  echo "✓ Prisma installé" | tee -a "$LOG_FILE"
  npx prisma --version | tee -a "$LOG_FILE"
else
  echo "❌ Prisma non installé" | tee -a "$LOG_FILE"
fi

# 13. Logs PM2
log_message "13. Logs PM2 (dernières 20 lignes)..."
pm2 logs --lines 20 | tee -a "$LOG_FILE"

# 14. Test de l'application
log_message "14. Test de l'application..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  echo "✓ Application accessible" | tee -a "$LOG_FILE"
else
  echo "❌ Application non accessible" | tee -a "$LOG_FILE"
fi

# 15. Erreurs de build
log_message "15. Test de build..."
if npm run build >/dev/null 2>&1; then
  echo "✓ Build réussi" | tee -a "$LOG_FILE"
else
  echo "❌ Build échoué" | tee -a "$LOG_FILE"
  echo "Tentative de build pour voir les erreurs:" | tee -a "$LOG_FILE"
  npm run build 2>&1 | tee -a "$LOG_FILE"
fi

log_message "--- Diagnostic complet terminé ---"
log_message "Consultez le fichier $LOG_FILE pour les détails"
