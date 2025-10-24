#!/bin/bash

# Fichier: fix-pm2-start.sh
# Description: Script pour corriger le démarrage PM2

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_pm2_start.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

error_exit() {
  log_message "ERREUR: $1"
  log_message "Correction échouée."
  exit 1
}

# --- Début du script ---
log_message "--- Démarrage de la correction du démarrage PM2 ---"

cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR"

# 1. Arrêter PM2 complètement
log_message "1. Arrêt complet de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 5
log_message "✓ PM2 arrêté"

# 2. Vérifier que nous sommes dans le bon répertoire
log_message "2. Vérification du répertoire..."
pwd
ls -la | head -10

# 3. Vérifier le fichier package.json
log_message "3. Vérification du fichier package.json..."
if [ -f "package.json" ]; then
  log_message "✓ package.json trouvé"
  cat package.json | grep -A 5 -B 5 "scripts" | tee -a "$LOG_FILE"
else
  error_exit "❌ package.json non trouvé"
fi

# 4. Vérifier le fichier .env
log_message "4. Vérification du fichier .env..."
if [ -f ".env" ]; then
  log_message "✓ .env trouvé"
  cat .env | head -5 | tee -a "$LOG_FILE"
else
  error_exit "❌ .env non trouvé"
fi

# 5. Vérifier que l'application est construite
log_message "5. Vérification de la construction..."
if [ -d ".next" ]; then
  log_message "✓ Application construite (.next trouvé)"
else
  log_message "⚠ Application non construite, construction..."
  npm run build || error_exit "Échec de la construction"
fi

# 6. Charger les variables d'environnement
log_message "6. Chargement des variables d'environnement..."
set -a
source .env
set +a

# 7. Vérifier les variables critiques
log_message "7. Vérification des variables critiques..."
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: $DATABASE_URL"

# 8. Démarrer l'application avec PM2 (sans --env production)
log_message "8. Démarrage de l'application avec PM2..."
pm2 start npm --name "$PM2_APP_NAME" -- run start
log_message "✓ Application démarrée avec PM2"

# 9. Attendre le démarrage
log_message "9. Attente du démarrage (30 secondes)..."
sleep 30

# 10. Vérifier le statut
log_message "10. Vérification du statut..."
pm2 status

# 11. Vérifier les logs
log_message "11. Vérification des logs (dernières 20 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 20

# 12. Tester l'application
log_message "12. Test de l'application..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  log_message "✓ Application accessible sur http://localhost:3000"
else
  log_message "❌ Application non accessible sur http://localhost:3000"
  log_message "Logs de l'application:"
  pm2 logs "$PM2_APP_NAME" --lines 10
fi

# 13. Tester l'API d'authentification
log_message "13. Test de l'API d'authentification..."
if curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' | grep -q "success"; then
  log_message "✓ API d'authentification fonctionne"
else
  log_message "❌ API d'authentification ne fonctionne pas"
  log_message "Logs de l'application:"
  pm2 logs "$PM2_APP_NAME" --lines 10
fi

# 14. Créer un script de test
log_message "14. Création d'un script de test..."
cat << 'EOF' > test-app.sh
#!/bin/bash
echo "Test de l'application..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  echo "✓ Application accessible sur http://localhost:3000"
else
  echo "❌ Application non accessible sur http://localhost:3000"
fi

echo "Test de l'API d'authentification..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' \
  -v
EOF

chmod +x test-app.sh
log_message "✓ Script test-app.sh créé"

log_message "--- Correction terminée ---"
log_message "Utilisez './test-app.sh' pour tester l'application"
log_message "L'application devrait maintenant fonctionner sur http://localhost:3000"
