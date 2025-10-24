#!/bin/bash

# Fichier: fix-public-url.sh
# Description: Script pour corriger le problème de l'URL publique

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_public_url.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du script ---
log_message "--- Démarrage de la correction de l'URL publique ---"

cd "$APP_DIR" || exit 1

# 1. Arrêter PM2
log_message "1. Arrêt de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 3

# 2. Vérifier et corriger le fichier .env
log_message "2. Vérification et correction du fichier .env..."
if [ -f ".env" ]; then
  log_message "Fichier .env trouvé, vérification du contenu..."
  cat .env | tee -a "$LOG_FILE"
else
  log_message "Fichier .env manquant, création..."
fi

# 3. Créer un fichier .env correct avec l'URL locale
log_message "3. Création d'un fichier .env avec l'URL locale..."
cat << EOF > .env
# Base de données PostgreSQL
DATABASE_URL="postgresql://stockapp:SMT2025@localhost:5432/stock_management?schema=public"

# Configuration de l'application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="http://localhost:3000"

# Session et sécurité
SESSION_SECRET="przFeJuWQFfZ15KGJ1+atTmeNfPH9IrlMiTVSXqPG08="
JWT_SECRET="Pq5NWU4IuduKa4qTBP7kU/noGGXhzp8eoQLpDy04Sd8="

# Configuration SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM_EMAIL="noreply@localhost"
SMTP_FROM_NAME="Monetique Tunisie - Gestion de Stocks"

# Configuration des notifications
NOTIFICATIONS_ENABLED="true"
NOTIFICATIONS_LOW_STOCK_ALERTS="true"
NOTIFICATIONS_MOVEMENT_NOTIFICATIONS="true"
NOTIFICATIONS_USER_ACTIVITY_ALERTS="true"
NOTIFICATIONS_LOW_STOCK_THRESHOLD="10"
NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD="5"
NOTIFICATIONS_EMAIL_NOTIFICATIONS="true"
NOTIFICATIONS_IN_APP_NOTIFICATIONS="true"
EOF

log_message "✓ Fichier .env créé avec l'URL locale"

# 4. Charger les variables d'environnement
log_message "4. Chargement des variables d'environnement..."
set -a
source .env
set +a

# 5. Vérifier les variables
log_message "5. Vérification des variables..."
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: $DATABASE_URL"
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"

# 6. Construire l'application
log_message "6. Construction de l'application..."
npm run build

# 7. Redémarrer l'application
log_message "7. Redémarrage de l'application..."
pm2 start npm --name "$PM2_APP_NAME" -- run start

# 8. Attendre le démarrage
log_message "8. Attente du démarrage (30 secondes)..."
sleep 30

# 9. Vérifier le statut
log_message "9. Vérification du statut..."
pm2 status

# 10. Tester l'API d'authentification en local
log_message "10. Test de l'API d'authentification en local..."
if curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' | grep -q "success"; then
  log_message "✓ API d'authentification fonctionne en local"
else
  log_message "✗ API d'authentification ne fonctionne pas en local"
  log_message "Logs de l'application:"
  pm2 logs "$PM2_APP_NAME" --lines 20
fi

# 11. Tester l'application complète
log_message "11. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  log_message "✓ Application accessible sur http://localhost:3000"
else
  log_message "✗ Application non accessible sur http://localhost:3000"
fi

# 12. Créer un script de test de l'API
log_message "12. Création d'un script de test de l'API..."
cat << 'EOF' > test-api.sh
#!/bin/bash
echo "Test de l'API d'authentification..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' \
  -v
EOF

chmod +x test-api.sh
log_message "✓ Script test-api.sh créé"

log_message "--- Correction terminée ---"
log_message "Utilisez './test-api.sh' pour tester l'API d'authentification"
log_message "L'application devrait maintenant fonctionner sur http://localhost:3000"
